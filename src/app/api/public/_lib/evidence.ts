import "server-only";

import { randomUUID } from "node:crypto";

import {
  ALLOWED_MIME,
  MAX_FILE_BYTES,
  type EvidenceMeta,
  type UploadedEvidence,
} from "@/lib/report/schema";
import type { AdminClient } from "@/lib/audit";

/**
 * Anexos do canal público, em um lugar só.
 *
 * O envio do relato (POST /api/public/reports) e o complemento de evidência
 * (POST /api/public/evidence/complement) fazem exatamente a mesma coisa com os
 * arquivos: emitem um ticket + URL assinada para `staging/`, releem o objeto no
 * Storage para não confiar em nenhum número declarado pelo cliente, movem para
 * `{orgId}/{reportId}/{evidenceId}.{ext}` e abrem a cadeia de custódia.
 * Duplicar isso em duas rotas era garantir que uma das duas ficasse para trás.
 */

/** Extensão inferida do MIME declarado, nunca do nome enviado pelo cliente. */
export const EXT_BY_MIME: Record<(typeof ALLOWED_MIME)[number], string> = {
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

export function extForMime(mime: string): string {
  return EXT_BY_MIME[mime as (typeof ALLOWED_MIME)[number]] ?? "bin";
}

/** Evidência já conferida contra o ticket de upload e contra o Storage. */
export type VerifiedEvidence = {
  ticketId: string;
  stagingPath: string;
  filename: string;
  mime: string;
  size: number;
  sha256: string | null;
};

export type SignedUploadItem = { clientId: string; path: string; token: string };

/**
 * Emite um ticket e uma URL de escrita por arquivo, sob `prefix`.
 *
 * O ticket é gravado ANTES do token: se o insert falhar, nenhuma URL de escrita
 * é entregue e nada fica órfão no bucket. Lança em qualquer falha — as rotas
 * traduzem para 500.
 */
export async function issueUploadTickets(
  supabase: AdminClient,
  orgId: string,
  files: Omit<EvidenceMeta, "sha256">[],
  prefix: string,
  ipHash: string,
): Promise<SignedUploadItem[]> {
  const items: SignedUploadItem[] = [];

  for (const file of files) {
    const path = `${prefix}/${randomUUID()}.${extForMime(file.mime)}`;

    const { error: ticketError } = await supabase.from("evidence_upload_tickets").insert({
      org_id: orgId,
      storage_path: path,
      filename: file.name,
      mime_type: file.mime,
      // Número declarado pelo cliente, guardado só para conferência. O tamanho
      // que vale é o relido do Storage na confirmação.
      size_bytes: file.size,
      ip_hash: ipHash,
    });
    if (ticketError) throw new Error(`ticket: ${ticketError.message}`);

    const { data: signed, error: signError } = await supabase.storage
      .from("evidence")
      .createSignedUploadUrl(path);

    if (signError || !signed) {
      throw new Error(`assinatura: ${signError?.message ?? "sem dados"}`);
    }

    items.push({ clientId: file.clientId, path, token: signed.token });
  }

  return items;
}

/**
 * Confere cada caminho declarado contra (a) um ticket de upload não consumido
 * da MESMA organização e (b) o objeto de verdade no Storage.
 *
 * Sem o ticket, um cliente poderia declarar o caminho do anexo de outro relato
 * e anexá-lo ao seu. Sem reler o objeto, `size` e `mime` seriam os números que
 * o próprio cliente inventou. Lança em qualquer irregularidade, com uma
 * mensagem já escrita para a pessoa.
 *
 * `requirePrefix` amarra o lote a uma sessão de upload (envio) ou ao relato
 * já conhecido pelo cookie (complemento).
 */
export async function verifyEvidenceTickets(
  supabase: AdminClient,
  orgId: string,
  declared: UploadedEvidence[],
  requirePrefix?: string | null,
): Promise<VerifiedEvidence[]> {
  if (declared.length === 0) return [];

  const paths = declared.map(e => e.path);
  if (new Set(paths).size !== paths.length) {
    throw new Error("Anexo repetido.");
  }

  const { data: tickets, error } = await supabase
    .from("evidence_upload_tickets")
    .select("id, storage_path, filename, expires_at, consumed_by_report")
    .eq("org_id", orgId)
    .in("storage_path", paths);

  if (error) {
    console.error("[evidence] tickets: %s", error.message);
    throw new Error("Não foi possível conferir os anexos.");
  }

  const byPath = new Map((tickets ?? []).map(t => [t.storage_path, t]));
  const out: VerifiedEvidence[] = [];

  for (const item of declared) {
    const ticket = byPath.get(item.path);
    if (!ticket) throw new Error("Anexo não reconhecido. Envie o arquivo novamente.");
    if (ticket.consumed_by_report) throw new Error("Anexo já usado em outro relato.");
    if (new Date(ticket.expires_at).getTime() < Date.now()) {
      throw new Error("O prazo do anexo expirou. Envie o arquivo novamente.");
    }
    if (requirePrefix && !item.path.startsWith(requirePrefix)) {
      throw new Error("Anexo fora da sessão de envio.");
    }

    const { data: info, error: infoError } = await supabase.storage
      .from("evidence")
      .info(item.path);

    if (infoError || !info) {
      throw new Error("Um dos arquivos não chegou ao servidor. Envie novamente.");
    }

    const size = info.size ?? 0;
    const mime = info.contentType ?? "";
    if (size <= 0) throw new Error("Arquivo vazio.");
    if (size > MAX_FILE_BYTES) throw new Error("Arquivo acima de 15 MB.");
    if (!(ALLOWED_MIME as readonly string[]).includes(mime)) {
      throw new Error("Tipo de arquivo não aceito.");
    }

    out.push({
      ticketId: ticket.id,
      stagingPath: item.path,
      filename: ticket.filename,
      mime,
      size,
      sha256: item.sha256 ?? null,
    });
  }

  return out;
}

/**
 * Move cada objeto de `staging/` para `{orgId}/{reportId}/…`, grava a linha em
 * `report_evidence` e abre a cadeia de custódia.
 *
 * Best-effort por arquivo: quando isto roda, o relato já existe e a pessoa já
 * vai receber uma resposta. O que falhar fica em staging e é apagado pelo cron;
 * a diferença entre declarado e anexado fica na trilha de auditoria.
 */
export async function attachEvidence(
  supabase: AdminClient,
  orgId: string,
  reportId: string,
  items: VerifiedEvidence[],
  custodyNote: string,
): Promise<string[]> {
  const attached: string[] = [];

  for (const item of items) {
    const evidenceId = randomUUID();
    const finalPath = `${orgId}/${reportId}/${evidenceId}.${extForMime(item.mime)}`;

    const { error: moveError } = await supabase.storage
      .from("evidence")
      .move(item.stagingPath, finalPath);
    if (moveError) {
      console.error("[evidence] move %s: %s", item.stagingPath, moveError.message);
      continue;
    }

    const { error: rowError } = await supabase.from("report_evidence").insert({
      id: evidenceId,
      org_id: orgId,
      report_id: reportId,
      storage_path: finalPath,
      filename: item.filename,
      mime_type: item.mime,
      size_bytes: item.size,
      sha256_client: item.sha256,
      uploaded_by_type: "reporter",
    });
    if (rowError) {
      console.error("[evidence] report_evidence: %s", rowError.message);
      continue;
    }

    const { error: custodyError } = await supabase.from("evidence_custody_events").insert({
      org_id: orgId,
      evidence_id: evidenceId,
      action: "coletada",
      actor_label: "Denunciante (canal público)",
      hash_at_event: item.sha256,
      notes: custodyNote,
    });
    if (custodyError) console.error("[evidence] custódia: %s", custodyError.message);

    const { error: ticketError } = await supabase
      .from("evidence_upload_tickets")
      .update({ consumed_by_report: reportId })
      .eq("id", item.ticketId)
      .eq("org_id", orgId);
    if (ticketError) console.error("[evidence] ticket consumido: %s", ticketError.message);

    attached.push(evidenceId);
  }

  return attached;
}
