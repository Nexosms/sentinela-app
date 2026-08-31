import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { uploadUrlRequestSchema, fieldErrors } from "@/lib/report/schema";
import { recordAudit } from "@/lib/audit";
import { clientIp, consume, hashKey, tooManyRequests, userAgentHash } from "@/lib/ratelimit";
import { issueUploadTickets } from "@/app/api/public/_lib/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/evidence/upload-url
 *
 * Devolve uma URL de upload assinada por arquivo. O bucket `evidence` é
 * privado e não tem NENHUMA policy em storage.objects: sem um token emitido
 * aqui é impossível escrever nele, mesmo com a chave anônima.
 *
 * Os arquivos vão para `staging/`, fora de qualquer relato. Só o POST de
 * /api/public/reports move o objeto para `{orgId}/{reportId}/…`; o que nunca
 * for reivindicado é apagado pelo cron de limpeza.
 *
 * O complemento de evidência de um relato já conhecido é outra rota:
 * /api/public/evidence/complement, que não pede orgSlug porque o cookie de
 * sessão já diz de qual relato se trata.
 */

/** Bucket de abuso: 40 tokens por IP a cada hora (≈7 envios completos). */
const RATE_LIMIT = 40;
const RATE_WINDOW = "01:00:00";

export async function POST(request: Request): Promise<Response> {
  const supabase = createAdminClient();
  const ip = clientIp(request);
  const ipHash = hashKey(ip);

  // Fail-open deliberado: ver a assimetria documentada em @/lib/ratelimit.
  // Aqui um soluço da tabela de contadores não pode impedir um envio.
  if (!(await consume(supabase, "evidence_upload_url", ip, RATE_LIMIT, RATE_WINDOW))) {
    return tooManyRequests(600);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = uploadUrlRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", fieldErrors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", input.orgSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (orgError) {
    console.error("[upload-url] organização: %s", orgError.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  if (!org) {
    return Response.json({ error: "org_not_found" }, { status: 404 });
  }

  const uploadSessionId = randomUUID();

  let items;
  try {
    items = await issueUploadTickets(
      supabase,
      org.id,
      input.files,
      `staging/${uploadSessionId}`,
      ipHash,
    );
  } catch (err) {
    console.error("[upload-url] %s", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  await recordAudit(supabase, {
    orgId: org.id,
    entityType: "evidence_upload_ticket",
    entityId: uploadSessionId,
    action: "evidence.upload_url_issued",
    actorType: "reporter",
    details: { upload_session_id: uploadSessionId, file_count: input.files.length },
    ipHash,
    userAgentHash: userAgentHash(request),
  });

  return Response.json({ uploadSessionId, items }, { status: 201 });
}
