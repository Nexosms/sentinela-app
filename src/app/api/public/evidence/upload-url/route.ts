import { randomUUID } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { uploadUrlRequestSchema, fieldErrors, ALLOWED_MIME } from "@/lib/report/schema";
import { recordAudit } from "@/lib/audit";
import { clientIp, consume, hashKey, tooManyRequests, userAgentHash } from "@/lib/ratelimit";

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
 */

/** Bucket de abuso: 40 tokens por IP a cada hora (≈7 envios completos). */
const RATE_LIMIT = 40;
const RATE_WINDOW = "01:00:00";

/** Extensão inferida do MIME declarado, nunca do nome enviado pelo cliente. */
const EXT_BY_MIME: Record<(typeof ALLOWED_MIME)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

export async function POST(request: Request): Promise<Response> {
  const supabase = createAdminClient();
  const ipHash = hashKey(clientIp(request));

  if (!(await consume(supabase, "evidence_upload_url", clientIp(request), RATE_LIMIT, RATE_WINDOW))) {
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
  const items: Array<{ clientId: string; path: string; token: string }> = [];

  for (const file of input.files) {
    const path = `staging/${uploadSessionId}/${randomUUID()}.${EXT_BY_MIME[file.mime]}`;

    // O ticket é gravado ANTES do token: se o insert falhar, nenhuma URL de
    // escrita é entregue, e nada fica órfão no bucket.
    const { error: ticketError } = await supabase.from("evidence_upload_tickets").insert({
      org_id: org.id,
      storage_path: path,
      filename: file.name,
      mime_type: file.mime,
      // Número declarado pelo cliente, guardado só para conferência. O tamanho
      // que vale é o relido do Storage na submissão.
      size_bytes: file.size,
      ip_hash: ipHash,
    });
    if (ticketError) {
      console.error("[upload-url] ticket: %s", ticketError.message);
      return Response.json({ error: "server_error" }, { status: 500 });
    }

    const { data: signed, error: signError } = await supabase.storage
      .from("evidence")
      .createSignedUploadUrl(path);

    if (signError || !signed) {
      console.error("[upload-url] assinatura: %s", signError?.message ?? "sem dados");
      return Response.json({ error: "server_error" }, { status: 500 });
    }

    items.push({ clientId: file.clientId, path, token: signed.token });
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
