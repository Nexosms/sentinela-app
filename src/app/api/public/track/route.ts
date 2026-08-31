import { createAdminClient } from "@/lib/supabase/admin";
import { trackRequestSchema, fieldErrors } from "@/lib/report/schema";
import { burnVerifyTime, verifySecret } from "@/lib/report/secret";
import { recordAudit } from "@/lib/audit";
import { clientIp, consumeStrict, hashKey, userAgentHash } from "@/lib/ratelimit";
import { TRACK_DENIED, TRACK_UNAVAILABLE } from "@/lib/report/tracking";
import {
  buildTrackedCase,
  TRACK_REPORT_COLUMNS,
  type TrackReportRow,
} from "@/app/api/public/_lib/tracked-case";
import { jsonWithSession, NO_STORE } from "@/app/api/public/_lib/reporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/public/track — a única porta que troca protocolo + chave por acesso
 * ao caso.
 *
 * O protótipo tinha `GET /api/reports?secret=…`, que (a) punha a chave na query
 * string, (b) respondia 404 "Protocolo não encontrado" quando o protocolo não
 * existia e 401 quando a chave estava errada — um oráculo de enumeração de
 * graça — e (c) comparava o segredo em texto puro.
 *
 * As quatro defesas desta rota, na ordem em que aparecem no código:
 *
 *  1. Dois baldes de limite, e o que importa é o POR PROTOCOLO: 5 por hora
 *     limita um caso a ~120 palpites por dia contra uma chave de 75 bits.
 *  2. Busca SÓ por protocolo, e o hash é verificado depois. Um
 *     `where protocol = ? and secret_hash = ?` transformaria o hash em
 *     credencial equivalente a texto puro e fecharia a porta para qualquer KDF.
 *  3. O KDF roda SEMPRE, inclusive para protocolo inexistente
 *     (`burnVerifyTime`), senão a latência da resposta diz quais são reais.
 *  4. Uma única resposta — 401 com TRACK_DENIED — para "não existe" e "chave
 *     errada". Nunca distinga os dois.
 */

/** Abuso genérico vindo de um mesmo lugar. */
const IP_LIMIT = 10;
const IP_WINDOW = "00:10:00";

/**
 * O balde que realmente protege a chave. É consumido ANTES de saber se o
 * protocolo existe — se só protocolos reais gastassem cota, o próprio
 * limitador viraria o oráculo de existência que o resto da rota evita.
 */
const PROTOCOL_LIMIT = 5;
const PROTOCOL_WINDOW = "01:00:00";

/** Formato guardado: XXXX-XXXX-XXXX. O schema aceita com ou sem hífen. */
function normalizeProtocol(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function denied(): Response {
  return Response.json(
    { error: "track_denied", message: TRACK_DENIED },
    { status: 401, headers: NO_STORE },
  );
}

function unavailable(): Response {
  return Response.json(
    { error: "track_unavailable", message: TRACK_UNAVAILABLE },
    { status: 503, headers: { ...NO_STORE, "Retry-After": "120" } },
  );
}

function rateLimited(retryAfterSeconds: number): Response {
  return Response.json(
    {
      error: "rate_limited",
      message: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    },
    { status: 429, headers: { ...NO_STORE, "Retry-After": String(retryAfterSeconds) } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const supabase = createAdminClient();
  const ip = clientIp(request);
  const ipHash = hashKey(ip);
  const uaHash = userAgentHash(request);

  // FAIL CLOSED — o oposto do POST /api/public/reports, e de propósito.
  // No envio, um erro do balde não pode fechar o canal de denúncia (fail-open).
  // Aqui o balde é a única coisa entre a chave de 75 bits e a força bruta:
  // deixar passar em caso de erro entregaria o bypass a quem derrubasse a RPC.
  const byIp = await consumeStrict(supabase, "track_ip", ip, IP_LIMIT, IP_WINDOW);
  if (byIp === "unavailable") return unavailable();
  if (byIp === "limited") return rateLimited(600);

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400, headers: NO_STORE });
  }

  const parsed = trackRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_failed", fieldErrors: fieldErrors(parsed.error) },
      { status: 400, headers: NO_STORE },
    );
  }

  const protocol = normalizeProtocol(parsed.data.protocol);

  // FAIL CLOSED, mesma razão do balde acima — e este é o que importa.
  const byProtocol = await consumeStrict(
    supabase,
    "track_protocol",
    protocol,
    PROTOCOL_LIMIT,
    PROTOCOL_WINDOW,
  );
  if (byProtocol === "unavailable") return unavailable();
  if (byProtocol === "limited") return rateLimited(900);

  // Busca por protocolo apenas. O hash nunca entra no WHERE.
  const { data: report, error } = await supabase
    .from("reports")
    .select(`${TRACK_REPORT_COLUMNS}, secret_hash`)
    .eq("protocol", protocol)
    .maybeSingle<TrackReportRow & { secret_hash: string }>();

  if (error) {
    console.error("[track] consulta: %s", error.message);
    await burnVerifyTime();
    return unavailable();
  }

  if (!report) {
    // Queima o mesmo tempo de CPU do caminho real. Sem isto a resposta
    // voltaria em ~2 ms para protocolo inexistente e ~100 ms para existente.
    await burnVerifyTime();
    return denied();
  }

  if (!(await verifySecret(parsed.data.secret, report.secret_hash))) {
    return denied();
  }

  let body;
  try {
    body = await buildTrackedCase(supabase, report);
  } catch (err) {
    console.error("[track] montagem do caso: %s", err instanceof Error ? err.message : err);
    return unavailable();
  }

  await recordAudit(supabase, {
    orgId: report.org_id,
    reportId: report.id,
    entityType: "report",
    entityId: report.id,
    action: "reporter.tracked",
    actorType: "reporter",
    details: {
      status: report.status,
      message_count: body.messages.length,
      evidence_count: body.evidence.length,
    },
    // Nunca o IP em claro: a tela de modalidade promete que ele não é gravado.
    ipHash,
    userAgentHash: uaHash,
  });

  return jsonWithSession(body, report.id, undefined, 200);
}
