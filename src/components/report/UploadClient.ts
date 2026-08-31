"use client";

import { createClient } from "@/lib/supabase/client";
import type { TrackedEvidence } from "@/lib/report/tracking";
import {
  ALLOWED_MIME,
  MAX_FILE_BYTES,
  MAX_FILES,
  type SubmitReportInput,
} from "@/lib/report/schema";

/**
 * Helper de upload do navegador.
 *
 * Os bytes vão DIRETO para o Storage do Supabase, com uma URL assinada obtida
 * do servidor. Nunca passam por uma função serverless da Vercel — o limite de
 * 4,5 MB de corpo tornaria inútil o teto de 15 MB por arquivo.
 * `uploadToSignedUrl` funciona sem sessão, que é exatamente o caso do
 * denunciante anônimo.
 */

const EVIDENCE_BUCKET = "evidence";

const COMPLEMENT_URL = "/api/public/evidence/complement";

/**
 * As rotas do acompanhamento devolvem `{error, message}`: a frase para a pessoa
 * está em `message`; `error` é código de máquina e nunca vai para a tela.
 */
async function readComplementError(response: Response): Promise<string> {
  const fallback =
    response.status === 401
      ? "Sua sessão de acompanhamento expirou. Consulte o protocolo novamente."
      : "Não foi possível anexar os arquivos ao caso. Nada foi adicionado.";
  try {
    const body = (await response.json()) as { message?: string; fieldErrors?: Record<string, string> };
    if (typeof body?.message === "string" && body.message) return body.message;
    const first = body?.fieldErrors ? Object.values(body.fieldErrors)[0] : null;
    return first || fallback;
  } catch {
    return fallback;
  }
}

/** Já validado em `validatePickedFiles`; o estreitamento é só de tipo. */
type AllowedMime = (typeof ALLOWED_MIME)[number];

export type UploadCandidate = { clientId: string; file: File };

export type UploadUrlItem = { clientId: string; path: string; token: string };

export type UploadUrlResponse = { uploadSessionId: string; items: UploadUrlItem[] };

export type ApiError = { error: string; fieldErrors?: Record<string, string> };

export type FileRejection = { name: string; reason: string };

export type UploadProgress = (clientId: string, progress: number, note?: string) => void;

/** Validação no momento da escolha. Um arquivo recusado precisa aparecer para
 *  a pessoa — o protótipo dava `continue` em silêncio e o denunciante seguia
 *  acreditando que a única prova dele tinha sido anexada. */
export function validatePickedFiles(
  incoming: File[],
  alreadySelected: number,
): { accepted: File[]; rejected: FileRejection[] } {
  const accepted: File[] = [];
  const rejected: FileRejection[] = [];
  let room = MAX_FILES - alreadySelected;

  for (const file of incoming) {
    if (room <= 0) {
      rejected.push({ name: file.name, reason: `limite de ${MAX_FILES} arquivos atingido` });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({
        name: file.name,
        reason: `${(file.size / 1024 / 1024).toFixed(1)} MB, acima do limite de 15 MB`,
      });
      continue;
    }
    if (file.size === 0) {
      rejected.push({ name: file.name, reason: "arquivo vazio" });
      continue;
    }
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
      rejected.push({
        name: file.name,
        reason: file.type ? `tipo não aceito (${file.type})` : "tipo de arquivo não reconhecido",
      });
      continue;
    }
    accepted.push(file);
    room -= 1;
  }

  return { accepted, rejected };
}

/** SHA-256 do arquivo, calculado no navegador. O servidor recalcula o dele a
 *  partir do que chegou no Storage; divergência é sinal de arquivo trocado. */
export async function sha256OfFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as ApiError;
    return body?.error || fallback;
  } catch {
    return fallback;
  }
}

export type UploadedEvidenceItem = {
  clientId: string;
  name: string;
  size: number;
  mime: AllowedMime;
  sha256: string;
  path: string;
};

export type UploadResult = {
  uploadSessionId: string;
  evidence: UploadedEvidenceItem[];
};

/** Hash de todos os candidatos, com progresso. Comum aos dois fluxos. */
async function hashAll(
  candidates: UploadCandidate[],
  onProgress: UploadProgress,
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  for (const candidate of candidates) {
    onProgress(candidate.clientId, 5, "hashing");
    hashes.set(candidate.clientId, await sha256OfFile(candidate.file));
    onProgress(candidate.clientId, 35, "hashed");
  }
  return hashes;
}

/**
 * Sobe os bytes para os destinos assinados e devolve os metadados que o
 * servidor vai reivindicar. Compartilhado pelo envio do relato e pelo
 * complemento no acompanhamento: os dois usam o mesmo bucket, o mesmo
 * `uploadToSignedUrl` e a mesma regra de "nada é anexado sem hash".
 */
async function pushToStorage(
  candidates: UploadCandidate[],
  items: UploadUrlItem[],
  hashes: Map<string, string>,
  onProgress: UploadProgress,
): Promise<UploadedEvidenceItem[]> {
  const byClientId = new Map(items.map(item => [item.clientId, item]));
  const supabase = createClient();
  const evidence: UploadedEvidenceItem[] = [];

  for (const candidate of candidates) {
    const target = byClientId.get(candidate.clientId);
    if (!target) throw new Error(`O servidor não devolveu destino para "${candidate.file.name}".`);

    onProgress(candidate.clientId, 55, "uploading");
    const { error } = await supabase.storage
      .from(EVIDENCE_BUCKET)
      .uploadToSignedUrl(target.path, target.token, candidate.file, {
        contentType: candidate.file.type,
      });
    if (error) throw new Error(`Falha ao enviar "${candidate.file.name}": ${error.message}`);
    onProgress(candidate.clientId, 100, "done");

    evidence.push({
      clientId: candidate.clientId,
      name: candidate.file.name,
      size: candidate.file.size,
      mime: candidate.file.type as AllowedMime,
      sha256: hashes.get(candidate.clientId)!,
      path: target.path,
    });
  }

  return evidence;
}

export async function uploadEvidence(
  orgSlug: string,
  candidates: UploadCandidate[],
  onProgress: UploadProgress,
): Promise<UploadResult> {
  const hashes = await hashAll(candidates, onProgress);

  const response = await fetch("/api/public/evidence/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orgSlug,
      files: candidates.map(candidate => ({
        clientId: candidate.clientId,
        name: candidate.file.name,
        size: candidate.file.size,
        mime: candidate.file.type,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Não foi possível preparar o envio dos anexos."));
  }

  const { uploadSessionId, items } = (await response.json()) as UploadUrlResponse;
  return {
    uploadSessionId,
    evidence: await pushToStorage(candidates, items, hashes, onProgress),
  };
}

export type SubmitResponse = {
  protocol: string;
  secret: string;
  receivedAt: string;
  status: string;
};

export async function submitReport(body: SubmitReportInput): Promise<SubmitResponse> {
  const response = await fetch("/api/public/reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        "Não foi possível registrar o relato agora. Nenhum protocolo foi gerado. Tente novamente em instantes.",
      ),
    );
  }

  return (await response.json()) as SubmitResponse;
}

/**
 * Complemento de evidências DEPOIS do envio, a partir de /acompanhar.
 *
 * Mesma mecânica do relato — hash no navegador, bytes direto para o Storage —
 * com duas diferenças que vêm da rota: não há `orgSlug` (o cookie de sessão já
 * diz qual é o relato) e as duas etapas moram no MESMO endpoint, separadas por
 * `action`: "sign" pega as URLs assinadas, "attach" reivindica os objetos.
 */
export async function complementEvidence(
  candidates: UploadCandidate[],
  onProgress: UploadProgress,
): Promise<TrackedEvidence[]> {
  const hashes = await hashAll(candidates, onProgress);

  const signed = await fetch(COMPLEMENT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "sign",
      files: candidates.map(candidate => ({
        clientId: candidate.clientId,
        name: candidate.file.name,
        size: candidate.file.size,
        mime: candidate.file.type,
      })),
    }),
  });
  if (!signed.ok) throw new Error(await readComplementError(signed));

  const { items } = (await signed.json()) as { items: UploadUrlItem[] };
  const uploads = await pushToStorage(candidates, items, hashes, onProgress);

  const attached = await fetch(COMPLEMENT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "attach", uploads }),
  });
  if (!attached.ok) throw new Error(await readComplementError(attached));

  const body = (await attached.json()) as { evidence: TrackedEvidence[] };
  return body.evidence;
}
