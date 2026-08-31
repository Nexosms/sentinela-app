import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  evidenceMetaSchema,
  uploadedEvidenceSchema,
  fieldErrors,
  MAX_FILES,
} from "@/lib/report/schema";
import { recordAudit } from "@/lib/audit";
import { clientIp, consumeStrict, hashKey, userAgentHash } from "@/lib/ratelimit";
import { TRACK_UNAVAILABLE, type TrackedEvidence } from "@/lib/report/tracking";
import {
  attachEvidence,
  issueUploadTickets,
  verifyEvidenceTickets,
} from "@/app/api/public/_lib/evidence";
import { isClosed } from "@/app/api/public/_lib/tracked-case";
import {
  jsonWithSession,
  loadTrackedReport,
  NO_STORE,
  sessionFrom,
  sessionRequired,
} from "@/app/api/public/_lib/reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/evidence/complement — anexar arquivos a um relato já aberto.
 *
 * Mesmo mecanismo do envio (URL assinada para `staging/`, releitura do objeto
 * no Storage, cadeia de custódia), com duas diferenças:
 *
 *  - Não recebe `orgSlug`. O cookie já diz qual é o relato, e daí sai a
 *    organização. Aceitar um slug aqui só abriria espaço para divergência.
 *  - O ticket fica amarrado ao relato pelo próprio caminho:
 *    `staging/{reportId}/…`. Não há coluna de vínculo em
 *    `evidence_upload_tickets`, e o id do relato é um UUID que só quem tem o
 *    cookie conhece — então o prefixo é o vínculo, conferido na confirmação.
 *
 * Duas etapas, como no envio: `action: "sign"` pega as URLs, `action: "attach"`
 * confirma. O objeto vai direto de `staging/` para
 * `{orgId}/{reportId}/{evidenceId}.{ext}` — nunca fica em staging depois disso.
 */

/** Por sessão/relato. Cobre ~3 lotes cheios por hora. */
const RATE_LIMIT = 20;
const RATE_WINDOW = "01:00:00";

const complementSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("sign"),
    files: z.array(evidenceMetaSchema.omit({ sha256: true })).min(1).max(MAX_FILES),
  }),
  z.object({
    action: z.literal("attach"),
    uploads: z.array(uploadedEvidenceSchema).min(1).max(MAX_FILES),
  }),
]);

function unavailable(): Response {
  return Response.json(
    { error: "track_unavailable", message: TRACK_UNAVAILABLE },
    { status: 503, headers: NO_STORE },
  );
}

export async function POST(request: Request): Promise<Response> {
  const session = sessionFrom(request);
  if (!session) return sessionRequired();

  const supabase = createAdminClient();

  // FAIL CLOSED, como nas demais rotas do acompanhamento. Ver a assimetria
  // documentada em @/lib/ratelimit: o fail-open existe só no ENVIO do relato.
  const consumed = await consumeStrict(
    supabase,
    "reporter_evidence",
    session.reportId,
    RATE_LIMIT,
    RATE_WINDOW,
  );
  if (consumed === "unavailable") return unavailable();
  if (consumed === "limited") {
    return Response.json(
      {
        error: "rate_limited",
        message: "Muitos anexos seguidos. Aguarde alguns minutos e tente de novo.",
      },
      { status: 429, headers: { ...NO_STORE, "Retry-After": "600" } },
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: NO_STORE });
  }

  const parsed = complementSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", fieldErrors: fieldErrors(parsed.error) },
      { status: 400, headers: NO_STORE },
    );
  }

  let report;
  try {
    report = await loadTrackedReport(supabase, session.reportId);
  } catch {
    return unavailable();
  }
  if (!report) return sessionRequired();

  if (isClosed(report.status)) {
    return Response.json(
      {
        error: "report_closed",
        message:
          "Este caso já foi encerrado e não recebe novos anexos. " +
          "Se houver fato novo, registre um novo relato.",
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const prefix = `staging/${report.id}`;
  const ipHash = hashKey(clientIp(request));
  const uaHash = userAgentHash(request);

  if (parsed.data.action === "sign") {
    let items;
    try {
      items = await issueUploadTickets(supabase, report.org_id, parsed.data.files, prefix, ipHash);
    } catch (err) {
      console.error("[complement] %s", err instanceof Error ? err.message : String(err));
      return unavailable();
    }

    await recordAudit(supabase, {
      orgId: report.org_id,
      reportId: report.id,
      entityType: "evidence_upload_ticket",
      entityId: report.id,
      action: "evidence.upload_url_issued",
      actorType: "reporter",
      details: { file_count: parsed.data.files.length, complement: true },
      ipHash,
      userAgentHash: uaHash,
    });

    return jsonWithSession({ items }, report.id, session.sessionStart, 201);
  }

  // ── attach ────────────────────────────────────────────────────────────────
  let verified;
  try {
    verified = await verifyEvidenceTickets(
      supabase,
      report.org_id,
      parsed.data.uploads,
      `${prefix}/`,
    );
  } catch (err) {
    return Response.json(
      {
        error: "evidence_invalid",
        fieldErrors: { evidence: err instanceof Error ? err.message : "Anexo inválido." },
      },
      { status: 400, headers: NO_STORE },
    );
  }

  const attachedIds = await attachEvidence(
    supabase,
    report.org_id,
    report.id,
    verified,
    "Complemento enviado pelo denunciante no acompanhamento.",
  );

  await recordAudit(supabase, {
    orgId: report.org_id,
    reportId: report.id,
    entityType: "report_evidence",
    entityId: report.id,
    action: "reporter.evidence_added",
    actorType: "reporter",
    details: { declared: verified.length, attached: attachedIds.length },
    ipHash,
    userAgentHash: uaHash,
  });

  const { data: rows, error } = await supabase
    .from("report_evidence")
    .select("id, filename, size_bytes, created_at, sha256_verified")
    .in("id", attachedIds.length > 0 ? attachedIds : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: true });

  if (error) console.error("[complement] releitura: %s", error.message);

  const evidence: TrackedEvidence[] = (rows ?? []).map(row => ({
    id: row.id,
    filename: row.filename,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    verified: row.sha256_verified !== null,
  }));

  return jsonWithSession({ evidence }, report.id, session.sessionStart, 201);
}
