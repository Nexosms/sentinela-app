import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sessão curta do denunciante.
 *
 * Verificar o segredo custa um scrypt de 32 MB (≈100 ms de CPU). Se cada
 * chamada de /acompanhar e cada mensagem enviada refizesse o KDF, a tela
 * ficaria lenta e o servidor viraria alvo fácil de DoS por CPU. Depois de UMA
 * verificação bem-sucedida, gravamos um cookie assinado que carrega apenas o
 * id do relato — nunca o segredo, nunca o protocolo.
 *
 * O cookie é HttpOnly (JS da página não lê), Secure e SameSite=Lax.
 *
 * Path=/ e não /acompanhar: a tela vive em /acompanhar mas conversa com
 * /api/public/track/case, /api/public/messages e /api/public/evidence/
 * complement. O navegador só envia o cookie para caminhos sob `Path`, então um
 * cookie preso a /acompanhar nunca chegaria às rotas que precisam dele. O que
 * protege a sessão é HttpOnly + SameSite=Lax + a validade curta (30 min
 * deslizantes, teto absoluto de 2 h), não o escopo de caminho.
 */

export const COOKIE_NAME = "sentinela_rt";
export const COOKIE_PATH = "/";

/** Validade de cada emissão. Renovada a cada uso (deslizante). */
const MAX_AGE_SECONDS = 1800;
/** Teto absoluto: 2 h após o primeiro login, o segredo é exigido de novo. */
const HARD_CAP_SECONDS = 7200;

type Payload = {
  /** report_id */
  r: string;
  /** emitido em (epoch, segundos) */
  iat: number;
  /** início da sessão (epoch, segundos) — base do teto absoluto */
  sst: number;
};

export type ReporterSession = { reportId: string; sessionStart: number };

function secret(): string {
  const value = process.env.REPORTER_SESSION_SECRET;
  if (!value) throw new Error("REPORTER_SESSION_SECRET ausente. Ver .env.example.");
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Emite um token. `sessionStart` vem da sessão anterior quando é renovação,
 * o que faz o teto de 2 h valer de verdade — sem isso a renovação deslizante
 * seria eterna.
 */
export function issueSession(reportId: string, sessionStart?: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = { r: reportId, iat: now, sst: sessionStart ?? now };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** Devolve a sessão quando o token é autêntico e está dentro dos dois prazos. */
export function readSession(token: string | undefined | null): ReporterSession | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!safeEqual(mac, sign(body))) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return null;
  }

  if (typeof payload.r !== "string" || !payload.r) return null;
  if (typeof payload.iat !== "number" || typeof payload.sst !== "number") return null;

  const now = Math.floor(Date.now() / 1000);
  if (now - payload.iat > MAX_AGE_SECONDS) return null;
  if (now - payload.sst > HARD_CAP_SECONDS) return null;

  return { reportId: payload.r, sessionStart: payload.sst };
}

type CookieSpec = {
  name: string;
  value: string;
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
};

/** Opções prontas para `cookies().set(...)` ou `NextResponse.cookies.set(...)`. */
export function sessionCookie(reportId: string, sessionStart?: number): CookieSpec {
  return {
    name: COOKIE_NAME,
    value: issueSession(reportId, sessionStart),
    httpOnly: true,
    // Em http://localhost o navegador descarta cookies Secure.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: MAX_AGE_SECONDS,
  };
}

/** Cookie de expurgo, para o "sair" da tela de acompanhamento. */
export function clearedSessionCookie(): CookieSpec {
  return { ...sessionCookie("x"), value: "", maxAge: 0 };
}

export const SESSION_MAX_AGE_SECONDS = MAX_AGE_SECONDS;
export const SESSION_HARD_CAP_SECONDS = HARD_CAP_SECONDS;
