"use client";

import {
  TRACK_DENIED,
  TRACK_UNAVAILABLE,
  type TrackedCase,
  type TrackedMessage,
} from "@/lib/report/tracking";

/**
 * Cliente HTTP da tela de acompanhamento.
 *
 * No protótipo o `handleTrack` tinha um curto-circuito: se o comprovante em
 * memória batesse com o que foi digitado, a tela "consultada" era renderizada
 * SEM nenhuma chamada de rede — status, mensagens e evidências eram inventados
 * pelo JSX. Aqui todo caminho passa pelo servidor; a tela não sabe desenhar um
 * caso que não veio de lá.
 */

const RATE_LIMITED =
  "Muitas tentativas a partir deste dispositivo. Aguarde alguns minutos e tente de novo.";

const CASE_CLOSED =
  "Este caso foi encerrado e não recebe mais mensagens. Se houver algo novo, registre um relato.";

/** Sessão do denunciante expirada ou ausente: é preciso digitar de novo. */
export const SESSION_EXPIRED =
  "Sua sessão de acompanhamento expirou por segurança. Consulte o protocolo novamente.";

export class TrackRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TrackRequestError";
    this.status = status;
  }
}

type ApiErrorBody = { error?: string; message?: string };

async function bodyMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return typeof body?.message === "string" && body.message ? body.message : null;
  } catch {
    return null;
  }
}

/**
 * Traduz o status HTTP em uma frase para a pessoa. O 401 usa SEMPRE a mesma
 * mensagem para "protocolo inexistente" e "chave errada" — distinguir os dois
 * transformaria a tela num oráculo de enumeração de protocolos.
 */
async function failureFor(response: Response, fallback: string): Promise<TrackRequestError> {
  const fromServer = await bodyMessage(response);
  switch (response.status) {
    case 400:
      return new TrackRequestError(400, fromServer ?? "Confira os dados informados.");
    case 401:
      return new TrackRequestError(401, TRACK_DENIED);
    case 409:
      return new TrackRequestError(409, fromServer ?? CASE_CLOSED);
    case 429:
      return new TrackRequestError(429, fromServer ?? RATE_LIMITED);
    case 503:
      return new TrackRequestError(503, TRACK_UNAVAILABLE);
    default:
      return new TrackRequestError(response.status, fromServer ?? fallback);
  }
}

/** Rede indisponível: mesma frase de indisponibilidade, sem detalhe técnico. */
function offline(): TrackRequestError {
  return new TrackRequestError(0, TRACK_UNAVAILABLE);
}

/** POST /api/public/track — única chamada que gasta o KDF do segredo. */
export async function openCase(protocol: string, secret: string): Promise<TrackedCase> {
  let response: Response;
  try {
    response = await fetch("/api/public/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ protocol, secret }),
    });
  } catch {
    throw offline();
  }
  if (!response.ok) throw await failureFor(response, TRACK_UNAVAILABLE);
  return (await response.json()) as TrackedCase;
}

/** GET /api/public/track/case — só o cookie de sessão; nada viaja na URL. */
export async function refreshCase(): Promise<TrackedCase> {
  let response: Response;
  try {
    response = await fetch("/api/public/track/case", { cache: "no-store" });
  } catch {
    throw offline();
  }
  if (response.status === 401) throw new TrackRequestError(401, SESSION_EXPIRED);
  if (!response.ok) throw await failureFor(response, TRACK_UNAVAILABLE);
  return (await response.json()) as TrackedCase;
}

/** POST /api/public/messages — o botão que no protótipo só mudava estado local. */
export async function sendMessage(body: string): Promise<TrackedMessage> {
  let response: Response;
  try {
    response = await fetch("/api/public/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
  } catch {
    throw offline();
  }
  if (response.status === 401) throw new TrackRequestError(401, SESSION_EXPIRED);
  if (!response.ok) {
    throw await failureFor(response, "Não foi possível enviar a mensagem agora. Tente de novo.");
  }
  const payload = (await response.json()) as { message: TrackedMessage };
  return payload.message;
}

/** Datas do servidor em ISO; a tela mostra em pt-BR, fuso do navegador. */
export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
