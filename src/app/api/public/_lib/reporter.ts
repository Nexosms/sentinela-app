import "server-only";

import {
  COOKIE_NAME,
  readSession,
  sessionCookie,
  type ReporterSession,
} from "@/lib/reporter-session";
import type { AdminClient } from "@/lib/audit";
import { TRACK_REPORT_COLUMNS, type TrackReportRow } from "@/app/api/public/_lib/tracked-case";

/**
 * Cola entre o cookie `sentinela_rt` e as rotas que só ele autoriza.
 *
 * Nenhuma destas rotas aceita protocolo ou chave: quem chega aqui já provou
 * posse do segredo em POST /api/public/track e carrega um token assinado com o
 * id do relato. Assim a tela navega sem repetir o scrypt de 32 MB a cada clique.
 */

/**
 * Nenhuma resposta do acompanhamento pode ficar em cache — nem do navegador,
 * nem de proxy, nem do CDN. É conteúdo de um caso, atrás de um cookie.
 */
export const NO_STORE = {
  "cache-control": "no-store, no-cache, must-revalidate",
  pragma: "no-cache",
} as const;

/** Lê o cookie direto do cabeçalho: a rota recebe um `Request` puro. */
export function sessionFrom(request: Request): ReporterSession | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== COOKIE_NAME) continue;
    return readSession(part.slice(eq + 1).trim());
  }
  return null;
}

/** `Set-Cookie` a partir da especificação de @/lib/reporter-session. */
export function serializeCookie(spec: ReturnType<typeof sessionCookie>): string {
  const parts = [
    `${spec.name}=${spec.value}`,
    `Path=${spec.path}`,
    `Max-Age=${spec.maxAge}`,
    "HttpOnly",
    `SameSite=${spec.sameSite === "lax" ? "Lax" : spec.sameSite}`,
  ];
  if (spec.secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Resposta JSON com o cookie renovado (janela deslizante de 30 min). O
 * `sessionStart` da sessão anterior é preservado para o teto de 2 h continuar
 * valendo — sem isso a renovação seria eterna.
 */
export function jsonWithSession(
  body: unknown,
  reportId: string,
  sessionStart: number | undefined,
  status = 200,
): Response {
  const spec = sessionCookie(reportId, sessionStart);
  return Response.json(body, {
    status,
    headers: { ...NO_STORE, "set-cookie": serializeCookie(spec) },
  });
}

/** Mesma mensagem para cookie ausente, expirado e adulterado. */
export function sessionRequired(): Response {
  return Response.json(
    {
      error: "session_required",
      message:
        "Sua sessão de acompanhamento expirou. Informe o protocolo e a chave novamente.",
    },
    { status: 401, headers: NO_STORE },
  );
}

/** Carrega o relato apontado pelo cookie. `null` quando ele não existe mais. */
export async function loadTrackedReport(
  supabase: AdminClient,
  reportId: string,
): Promise<TrackReportRow | null> {
  const { data, error } = await supabase
    .from("reports")
    .select(TRACK_REPORT_COLUMNS)
    .eq("id", reportId)
    .maybeSingle<TrackReportRow>();

  if (error) {
    console.error("[track] relato da sessão: %s", error.message);
    throw new Error(error.message);
  }
  return data;
}
