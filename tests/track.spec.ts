import { test, expect, request as playwrightRequest } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * POST /api/public/track e o que ele nunca pode devolver.
 *
 * O foco é o filtro `internal = true`: as anotações que a equipe escreve entre
 * si sobre o caso — e frequentemente sobre a pessoa que denunciou — não podem
 * chegar ao denunciante. É o vazamento mais grave possível nesta rota, e o
 * único jeito honesto de testar é com a linha real no banco.
 */

const ORG_SLUG = process.env.NEXT_PUBLIC_DEFAULT_ORG_SLUG ?? "sentinela";
const MARK = "SENTINELA-E2E-TRACK";

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.");
  return createClient(url, key, { auth: { persistSession: false } });
}

type Created = { reportId: string; orgId: string; protocol: string; secret: string };

/** Envia um relato de verdade e devolve protocolo + chave. */
async function createReport(baseURL: string): Promise<Created> {
  const db = admin();

  const { data: org } = await db.from("organizations").select("id").eq("slug", ORG_SLUG).single();
  const { data: category } = await db
    .from("categories")
    .select("id")
    .eq("is_active", true)
    .eq("requires_specification", false)
    .limit(1)
    .single();

  const api = await playwrightRequest.newContext({ baseURL });
  const response = await api.post("/api/public/reports", {
    // IP aleatório: o balde de envio é por IP e não pode estourar entre testes.
    headers: { "x-forwarded-for": `10.240.${Math.floor(Math.random() * 250)}.7` },
    data: {
      orgSlug: ORG_SLUG,
      idempotencyKey: randomUUID(),
      declarationAccepted: true,
      evidence: [],
      mode: "anonymous",
      relationship: "colaborador",
      orgUnitId: null,
      unitUnknown: true,
      periodText: "agosto de 2026",
      city: "São Paulo",
      accused: "não identificado",
      recurrence: "once",
      categoryIds: [category!.id],
      description: `${MARK} — relato criado pelo teste automatizado da rota de acompanhamento.`,
      retaliation: false,
      urgent: false,
    },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  await api.dispose();

  const { data: report } = await db
    .from("reports")
    .select("id")
    .eq("protocol", body.protocol)
    .single();

  return { reportId: report!.id, orgId: org!.id, protocol: body.protocol, secret: body.secret };
}

/**
 * Apaga o que o teste criou.
 *
 * `reports` só cai junto com as linhas de `audit_events` que apontam para ele,
 * e a trilha é imutável por RULE — a FK é ON DELETE SET NULL, ou seja, um
 * UPDATE que a RULE recusa. Apagar de fato exige desligar os gatilhos:
 *
 *   begin; set local session_replication_role = replica;
 *   delete from audit_events where report_id in (...);
 *   delete from reports where description like 'SENTINELA-E2E-TRACK%';
 *   commit;
 *
 * Isso não é feito pelo teste de propósito: nada aqui deve ter permissão de
 * mexer na trilha de auditoria. O teste limpa tudo o que pode e avisa o que
 * sobrou, sempre marcado por `MARK`.
 */
test.afterAll(async () => {
  const db = admin();
  const { data: rows } = await db.from("reports").select("id").like("description", `${MARK}%`);
  const ids = (rows ?? []).map(r => r.id);
  if (ids.length === 0) return;

  await db.from("report_messages").delete().in("report_id", ids);
  await db.from("report_status_history").delete().in("report_id", ids);
  await db.from("report_categories").delete().in("report_id", ids);
  await db.from("notifications").delete().in("report_id", ids);

  const { error } = await db.from("reports").delete().in("id", ids);
  if (error) {
    console.warn(
      `[e2e] ${ids.length} relato(s) '${MARK}' permanecem no banco (trilha imutável): ${error.message}`,
    );
  }
});

test("nota interna da equipe nunca chega ao denunciante", async ({ request, baseURL }) => {
  const created = await createReport(baseURL!);
  const db = admin();

  const { data: profile } = await db.from("profiles").select("id").limit(1).single();

  const rows = [
    {
      org_id: created.orgId,
      report_id: created.reportId,
      author_type: "staff" as const,
      author_id: profile!.id,
      internal: true,
      body: "NOTA INTERNA: hipótese da equipe sobre quem é o denunciante.",
    },
    {
      org_id: created.orgId,
      report_id: created.reportId,
      author_type: "staff" as const,
      author_id: profile!.id,
      internal: false,
      body: "Recebemos seu relato e já iniciamos a triagem.",
    },
  ];
  const { error } = await db.from("report_messages").insert(rows);
  expect(error, error?.message).toBeNull();

  const response = await request.post("/api/public/track", {
    headers: { "x-forwarded-for": `10.241.${Math.floor(Math.random() * 250)}.7` },
    data: { protocol: created.protocol, secret: created.secret },
  });
  expect(response.status()).toBe(200);

  const body = await response.json();
  const bodies = body.messages.map((m: { body: string }) => m.body);

  expect(bodies).toContain("Recebemos seu relato e já iniciamos a triagem.");
  expect(JSON.stringify(body)).not.toContain("NOTA INTERNA");
  expect(body.messages).toHaveLength(1);
});

test("desfecho não publicado não vaza", async ({ request, baseURL }) => {
  const created = await createReport(baseURL!);
  const db = admin();

  await db
    .from("reports")
    .update({
      closure_summary: "Resumo interno do desfecho, ainda não publicado.",
      closure_disclosed_at: null,
    })
    .eq("id", created.reportId);

  const response = await request.post("/api/public/track", {
    headers: { "x-forwarded-for": `10.242.${Math.floor(Math.random() * 250)}.7` },
    data: { protocol: created.protocol, secret: created.secret },
  });
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.closureSummary).toBeNull();
  expect(JSON.stringify(body)).not.toContain("ainda não publicado");
});

test("protocolo inexistente e chave errada devolvem a MESMA resposta", async ({
  request,
  baseURL,
}) => {
  const created = await createReport(baseURL!);

  const wrongSecret = await request.post("/api/public/track", {
    headers: { "x-forwarded-for": `10.243.${Math.floor(Math.random() * 250)}.7` },
    data: { protocol: created.protocol, secret: "SEN-00000-00000-00000" },
  });
  const noSuchProtocol = await request.post("/api/public/track", {
    headers: { "x-forwarded-for": `10.244.${Math.floor(Math.random() * 250)}.7` },
    data: { protocol: "ZZZZ-ZZZZ-ZZZZ", secret: "SEN-00000-00000-00000" },
  });

  expect(wrongSecret.status()).toBe(401);
  expect(noSuchProtocol.status()).toBe(401);
  expect(await wrongSecret.text()).toBe(await noSuchProtocol.text());
});

test("evidência nunca expõe o caminho no Storage", async ({ request, baseURL }) => {
  const created = await createReport(baseURL!);

  const response = await request.post("/api/public/track", {
    headers: { "x-forwarded-for": `10.245.${Math.floor(Math.random() * 250)}.7` },
    data: { protocol: created.protocol, secret: created.secret },
  });
  expect(response.status()).toBe(200);
  expect(await response.text()).not.toContain("storage_path");
});
