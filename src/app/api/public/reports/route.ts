import { createAdminClient } from "@/lib/supabase/admin";
import {
  submitReportSchema,
  fieldErrors,
  type SubmitReportInput,
} from "@/lib/report/schema";
import {
  attachEvidence,
  verifyEvidenceTickets,
  type VerifiedEvidence,
} from "@/app/api/public/_lib/evidence";
import { generateSecret, hashSecret } from "@/lib/report/secret";
import { recordAudit, type AdminClient } from "@/lib/audit";
import { clientIp, consume, hashKey, tooManyRequests, userAgentHash } from "@/lib/ratelimit";
import type { Database } from "@/lib/supabase/database.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/reports — registro de um relato.
 *
 * NÃO existe GET. O protótipo tinha `GET /api/reports?secret=…`, o que colocava
 * a chave de acompanhamento na query string: log de acesso do servidor, log do
 * CDN, histórico do navegador e cabeçalho Referer de qualquer link clicado
 * depois. A consulta vive em POST /api/public/track.
 *
 * Esta é a única resposta da aplicação inteira que contém o segredo em claro.
 */

const RATE_LIMIT = 8;
const RATE_WINDOW = "01:00:00";

type RiskLevel = Database["public"]["Enums"]["risk_level"];
const RISK_ORDER: RiskLevel[] = ["baixo", "moderado", "alto", "critico"];

/**
 * DECISÃO DE IDEMPOTÊNCIA — reemissão dentro de uma janela curta.
 *
 * O problema: o segredo é derivado por scrypt e só existe em claro dentro
 * desta requisição. Se a resposta se perde (4G que cai no envio, aba fechada,
 * timeout do proxy) o relato está gravado e ninguém consegue mais abri-lo.
 *
 * As alternativas, e por que foram descartadas:
 *
 *  a) "Devolver a MESMA resposta" — impossível. Guardar o segredo em claro
 *     para poder repeti-lo destruiria a razão de existir do hash.
 *  b) 409 seco na repetição — é exatamente o cenário que precisamos evitar:
 *     a pessoa fica com um relato registrado e inacessível para sempre.
 *  c) Curto-circuito antes do INSERT — resolve a duplicação da linha, mas não
 *     o segredo perdido: a segunda chamada continua sem ter o que devolver.
 *
 * O que fazemos: na repetição da MESMA `idempotencyKey`, dentro de
 * REPLAY_WINDOW_MS após a criação, geramos um segredo NOVO, gravamos o hash
 * (com `secret_rotated_at`) e devolvemos o mesmo protocolo. Nenhum relato
 * duplicado é criado e ninguém sai sem chave.
 *
 * O `idempotencyKey` é um UUID v4 gerado no navegador (122 bits) e enviado só
 * nesta requisição, então funciona como portador de curta duração — o mesmo
 * nível de entropia do próprio segredo. A janela de 30 minutos limita isso à
 * sessão de envio: passado esse prazo a resposta é 409 e o caminho correto
 * passa a ser o suporte da organização, não uma chave que se renova sozinha.
 * Toda reemissão fica na trilha de auditoria como `report.secret_reissued`.
 */
const REPLAY_WINDOW_MS = 30 * 60 * 1000;

type OrgRow = { id: string; sla_triagem_hours: number };

function contactKind(contact: string): string {
  if (contact.includes("@")) return "email";
  if (contact.replace(/\D/g, "").length >= 8) return "telefone";
  return "outro";
}

export async function POST(request: Request): Promise<Response> {
  const supabase = createAdminClient();
  const ip = clientIp(request);
  const ipHash = hashKey(ip);
  const uaHash = userAgentHash(request);

  if (!(await consume(supabase, "report_submit", ip, RATE_LIMIT, RATE_WINDOW))) {
    return tooManyRequests(900);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = submitReportSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }
  const input: SubmitReportInput = parsed.data;

  // ── Organização ───────────────────────────────────────────────────────────
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, sla_triagem_hours")
    .eq("slug", input.orgSlug)
    .eq("is_active", true)
    .maybeSingle<OrgRow>();

  if (orgError) {
    console.error("[reports] organização: %s", orgError.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  if (!org) return Response.json({ error: "org_not_found" }, { status: 404 });

  // ── Catálogo: as categorias precisam ser desta organização (ou globais) ───
  const categoryIds = [...new Set(input.categoryIds)];
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, requires_specification, default_risk")
    .in("id", categoryIds)
    .eq("is_active", true)
    .or(`org_id.is.null,org_id.eq.${org.id}`);

  if (catError) {
    console.error("[reports] categorias: %s", catError.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  if (!categories || categories.length !== categoryIds.length) {
    return Response.json(
      {
        error: "validation_failed",
        message: "Categoria inválida.",
        fieldErrors: { categoryIds: "Categoria inválida." },
      },
      { status: 400 },
    );
  }

  const specification = input.categorySpecification?.trim() ?? "";
  if (categories.some(c => c.requires_specification) && specification.length === 0) {
    return Response.json(
      {
        error: "validation_failed",
        fieldErrors: { categorySpecification: "Especifique a opção selecionada." },
      },
      { status: 400 },
    );
  }

  // O risco inicial da triagem sai do catálogo, não do padrão 'baixo' da tabela.
  const risk = categories.reduce<RiskLevel>(
    (worst, c) =>
      RISK_ORDER.indexOf(c.default_risk) > RISK_ORDER.indexOf(worst) ? c.default_risk : worst,
    "baixo",
  );

  // ── Unidade ───────────────────────────────────────────────────────────────
  if (input.orgUnitId) {
    const { data: unit, error: unitError } = await supabase
      .from("org_units")
      .select("id")
      .eq("id", input.orgUnitId)
      .eq("org_id", org.id)
      .eq("is_active", true)
      .maybeSingle();
    if (unitError) {
      console.error("[reports] unidade: %s", unitError.message);
      return Response.json({ error: "server_error" }, { status: 500 });
    }
    if (!unit) {
      return Response.json(
        { error: "validation_failed", fieldErrors: { orgUnitId: "Unidade inválida." } },
        { status: 400 },
      );
    }
  }

  // ── Repetição da mesma idempotencyKey (ver comentário acima) ──────────────
  const existing = await findExisting(supabase, org.id, input.idempotencyKey);
  if (existing) return replay(supabase, org.id, existing, ipHash, uaHash);

  // ── Evidências: conferidas ANTES do INSERT ────────────────────────────────
  // Depois que a linha do relato existe, nada pode virar 500 — então tudo que
  // é motivo para recusar a submissão inteira acontece aqui.
  let verified: VerifiedEvidence[];
  try {
    verified = await verifyEvidenceTickets(
      supabase,
      org.id,
      input.evidence,
      input.uploadSessionId ? `staging/${input.uploadSessionId}/` : null,
    );
  } catch (err) {
    return Response.json(
      {
        error: "evidence_invalid",
        fieldErrors: { evidence: err instanceof Error ? err.message : "Anexo inválido." },
      },
      { status: 400 },
    );
  }

  // ── Segredo ───────────────────────────────────────────────────────────────
  const secret = generateSecret();
  const secretHash = await hashSecret(secret);

  const createdAt = new Date();
  const dueAt = new Date(createdAt.getTime() + org.sla_triagem_hours * 3600_000);

  const { data: report, error: insertError } = await supabase
    .from("reports")
    .insert({
      org_id: org.id,
      idempotency_key: input.idempotencyKey,
      mode: input.mode,
      secret_hash: secretHash,
      relationship: input.relationship,
      org_unit_id: input.orgUnitId,
      unit_unknown: input.unitUnknown,
      period_text: input.periodText,
      city: input.city,
      location: input.location || null,
      accused: input.accused,
      witnesses: input.witnesses || null,
      recurrence: input.recurrence as Database["public"]["Enums"]["recurrence_kind"],
      category_specification: specification || null,
      description: input.description,
      retaliation: input.retaliation,
      urgent: input.urgent,
      risk,
      source: "web",
      created_at: createdAt.toISOString(),
      due_at: dueAt.toISOString(),
    })
    .select("id, protocol, status, created_at")
    .single();

  if (insertError || !report) {
    // Corrida: duas submissões idênticas ao mesmo tempo. A unique parcial em
    // (org_id, idempotency_key) barra a segunda; ela cai na reemissão.
    if (insertError?.code === "23505") {
      const raced = await findExisting(supabase, org.id, input.idempotencyKey);
      if (raced) return replay(supabase, org.id, raced, ipHash, uaHash);
    }
    console.error("[reports] insert: %s", insertError?.message ?? "sem dados");
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  // ══ A partir daqui a pessoa TEM um relato. Nada devolve 500. ══════════════

  await attachCategories(supabase, report.id, categoryIds);

  if (input.mode === "identified") {
    const contact = input.identityContact?.trim() || null;
    const { error } = await supabase.from("report_identities").insert({
      report_id: report.id,
      org_id: org.id,
      full_name: input.identityName?.trim() || null,
      contact,
      contact_kind: contact ? contactKind(contact) : null,
      consent_to_contact: Boolean(contact),
      consent_to_disclose_to_accused: false,
    });
    if (error) console.error("[reports] identidade: %s", error.message);
  }

  const attached = await attachEvidence(
    supabase,
    org.id,
    report.id,
    verified,
    "Recebida no envio do relato.",
  );

  await recordAudit(supabase, {
    orgId: org.id,
    reportId: report.id,
    entityType: "report",
    entityId: report.id,
    action: "report.created",
    actorType: "reporter",
    details: {
      mode: input.mode,
      risk,
      category_count: categoryIds.length,
      evidence_declared: verified.length,
      evidence_attached: attached.length,
      retaliation: input.retaliation,
      urgent: input.urgent,
      source: "web",
    },
    ipHash,
    userAgentHash: uaHash,
  });

  await notify(supabase, org.id, report.id, report.protocol, input, risk);

  return Response.json(
    {
      protocol: report.protocol,
      secret,
      receivedAt: report.created_at,
      status: report.status,
    },
    { status: 201 },
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type ExistingReport = {
  id: string;
  protocol: string;
  status: Database["public"]["Enums"]["report_status"];
  created_at: string;
};

async function findExisting(
  supabase: AdminClient,
  orgId: string,
  idempotencyKey: string,
): Promise<ExistingReport | null> {
  const { data, error } = await supabase
    .from("reports")
    .select("id, protocol, status, created_at")
    .eq("org_id", orgId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<ExistingReport>();

  if (error) {
    console.error("[reports] idempotência: %s", error.message);
    return null;
  }
  return data;
}

/** Reemissão do segredo para a mesma idempotencyKey. Ver REPLAY_WINDOW_MS. */
async function replay(
  supabase: AdminClient,
  orgId: string,
  existing: ExistingReport,
  ipHash: string,
  uaHash: string | null,
): Promise<Response> {
  const age = Date.now() - new Date(existing.created_at).getTime();
  if (age > REPLAY_WINDOW_MS) {
    await recordAudit(supabase, {
      orgId,
      reportId: existing.id,
      entityType: "report",
      entityId: existing.id,
      action: "report.replay_refused",
      actorType: "reporter",
      details: { reason: "replay_window_expired", age_seconds: Math.round(age / 1000) },
      ipHash,
      userAgentHash: uaHash,
    });
    return Response.json(
      {
        error: "already_submitted",
        message:
          "Este relato já foi registrado e o prazo para reemitir a chave expirou. " +
          "Procure o canal de suporte da organização informando o protocolo.",
        protocol: existing.protocol,
      },
      { status: 409 },
    );
  }

  // Guarda adicional: a reemissão só é segura enquanto ninguém provou ter a
  // chave original. Se já houve uma consulta de protocolo bem-sucedida ou uma
  // mensagem do denunciante, sabemos que ele TEM a chave — rotacionar aqui o
  // trancaria para fora do próprio relato. Nesse caso, recusa.
  const [{ count: trackedCount }, { count: messageCount }] = await Promise.all([
    supabase
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("report_id", existing.id)
      .eq("action", "reporter.tracked"),
    supabase
      .from("report_messages")
      .select("id", { count: "exact", head: true })
      .eq("report_id", existing.id)
      .eq("author_type", "reporter"),
  ]);

  if ((trackedCount ?? 0) > 0 || (messageCount ?? 0) > 0) {
    await recordAudit(supabase, {
      orgId,
      reportId: existing.id,
      entityType: "report",
      entityId: existing.id,
      action: "report.replay_refused",
      actorType: "reporter",
      details: { reason: "original_secret_already_used", age_seconds: Math.round(age / 1000) },
      ipHash,
      userAgentHash: uaHash,
    });
    return Response.json(
      {
        error: "already_submitted",
        message:
          "Este relato já foi registrado e a chave original já foi utilizada. " +
          "Use a chave que você recebeu no envio.",
        protocol: existing.protocol,
      },
      { status: 409 },
    );
  }

  const secret = generateSecret();
  const secretHash = await hashSecret(secret);

  const { error } = await supabase
    .from("reports")
    .update({ secret_hash: secretHash, secret_rotated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .eq("org_id", orgId);

  if (error) {
    console.error("[reports] reemissão: %s", error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  await recordAudit(supabase, {
    orgId,
    reportId: existing.id,
    entityType: "report",
    entityId: existing.id,
    action: "report.secret_reissued",
    actorType: "reporter",
    details: { reason: "idempotent_replay", age_seconds: Math.round(age / 1000) },
    ipHash,
    userAgentHash: uaHash,
  });

  return Response.json(
    {
      protocol: existing.protocol,
      secret,
      receivedAt: existing.created_at,
      status: existing.status,
      reissued: true,
    },
    { status: 200 },
  );
}

/**
 * Uma caixa marcada duas vezes no cliente não pode derrubar a submissão
 * inteira — daí o `ignoreDuplicates` (ON CONFLICT DO NOTHING).
 */
async function attachCategories(
  supabase: AdminClient,
  reportId: string,
  categoryIds: string[],
): Promise<void> {
  const rows = categoryIds.map((categoryId, index) => ({
    report_id: reportId,
    category_id: categoryId,
    is_primary: index === 0,
    assigned_by_reporter: true,
  }));
  const { error } = await supabase
    .from("report_categories")
    .upsert(rows, { onConflict: "report_id,category_id", ignoreDuplicates: true });
  if (error) console.error("[reports] categorias: %s", error.message);
}

/**
 * A organização optou por avisos no painel, sem e-mail. `target_roles` decide
 * quem vê; nada do conteúdo do relato entra no título ou no corpo.
 */
async function notify(
  supabase: AdminClient,
  orgId: string,
  reportId: string,
  protocol: string,
  input: SubmitReportInput,
  risk: RiskLevel,
): Promise<void> {
  type Row = Database["public"]["Tables"]["notifications"]["Insert"];
  const base = {
    org_id: orgId,
    report_id: reportId,
    entity_type: "report",
    entity_id: reportId,
    target_roles: ["admin", "triagem"] as Database["public"]["Enums"]["app_role"][],
  };

  const rows: Row[] = [
    {
      ...base,
      kind: "report.created",
      title: `Novo relato ${protocol}`,
      body: `Recebido pelo canal público. Risco inicial: ${risk}.`,
    },
  ];

  if (input.urgent || risk === "critico") {
    rows.push({
      ...base,
      kind: "report.critical",
      title: `Relato ${protocol} marcado como urgente`,
      body: "Priorize a triagem deste relato.",
    });
  }

  if (input.retaliation) {
    rows.push({
      ...base,
      kind: "report.retaliation",
      title: `Relato ${protocol} menciona retaliação`,
      body: "Avalie medidas de proteção antes de qualquer contato.",
    });
  }

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.error("[reports] notificações: %s", error.message);
}
