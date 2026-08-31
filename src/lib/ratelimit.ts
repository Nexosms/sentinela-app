import "server-only";

import { createHmac } from "node:crypto";
import type { AdminClient } from "@/lib/audit";

/**
 * A tela de modalidade promete: "Nenhum nome, e-mail, telefone, IP ou
 * identificador é solicitado". O IP é necessário para conter abuso, mas nunca
 * pode ser gravado — nem em log, nem em coluna. Tudo que sai daqui é um HMAC
 * com pimenta secreta: sem `IP_HASH_PEPPER` o hash não é reversível por força
 * bruta sobre os ~4 bilhões de IPv4.
 */
function pepper(): string {
  const value = process.env.IP_HASH_PEPPER;
  if (!value) throw new Error("IP_HASH_PEPPER ausente. Ver .env.example.");
  return value;
}

export function hashKey(value: string): string {
  return createHmac("sha256", pepper()).update(value).digest("hex");
}

/**
 * IP do cliente atrás do proxy da Vercel. `x-forwarded-for` pode vir como
 * lista; o primeiro elemento é o cliente. Sem cabeçalho (curl local, teste)
 * cai em "unknown" — todos compartilham o mesmo balde, o que é conservador.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Hash de user-agent, para a trilha de auditoria. Mesmo tratamento do IP. */
export function userAgentHash(request: Request): string | null {
  const ua = request.headers.get("user-agent");
  return ua ? hashKey(ua) : null;
}

/*
 * `app.consume_rate_limit` não é alcançável por PostgREST — só os schemas
 * `public` e `graphql_public` são expostos (PGRST106). A migração 021 criou
 * `public.consume_rate_limit`, um invólucro com EXECUTE apenas para
 * service_role, já presente nos tipos gerados.
 */

/**
 * Resultado explícito do balde. `unavailable` é o erro de infraestrutura, e
 * cada rota decide o que fazer com ele — ver a assimetria abaixo.
 */
export type ConsumeResult = "allowed" | "limited" | "unavailable";

/**
 * Consome uma unidade do balde e devolve o resultado SEM decidir por quem
 * chamou. A janela é um `interval` do Postgres ("00:15:00").
 *
 * ASSIMETRIA DELIBERADA entre as rotas públicas:
 *
 *  - No ENVIO do relato (`consume`, fail-open) um erro de RPC não pode fechar
 *    o canal: recusar uma denúncia porque a tabela de contadores teve um
 *    soluço é o dano maior.
 *  - Na CONSULTA por protocolo (`consumeStrict`, fail-closed) o limitador é a
 *    única coisa entre a chave de 75 bits e a força bruta. Falhar aberto ali
 *    entregaria o bypass do limitador a quem conseguisse derrubar a função.
 */
export async function consumeStrict(
  supabase: AdminClient,
  bucket: string,
  key: string,
  limit: number,
  window: string,
): Promise<ConsumeResult> {
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_bucket: bucket,
    p_key_hash: hashKey(key),
    p_limit: limit,
    p_window: window,
  });
  if (error) {
    console.error("[ratelimit] balde %s indisponível: %s", bucket, error.message);
    return "unavailable";
  }
  return data === false ? "limited" : "allowed";
}

/**
 * Variante fail-open: devolve `true` quando a requisição é permitida E também
 * quando o balde está indisponível. Ver a assimetria em `consumeStrict`.
 */
export async function consume(
  supabase: AdminClient,
  bucket: string,
  key: string,
  limit: number,
  window: string,
): Promise<boolean> {
  return (await consumeStrict(supabase, bucket, key, limit, window)) !== "limited";
}

/** Resposta padrão de estouro de limite, com o cabeçalho que o cliente espera. */
export function tooManyRequests(retryAfterSeconds: number): Response {
  return Response.json(
    { error: "rate_limited", message: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}
