import { createAdminClient } from "@/lib/supabase/admin";
import { reporterMessageSchema, fieldErrors } from "@/lib/report/schema";
import { recordAudit } from "@/lib/audit";
import { clientIp, consumeStrict, hashKey, userAgentHash } from "@/lib/ratelimit";
import { TRACK_UNAVAILABLE, type TrackedMessage } from "@/lib/report/tracking";
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
 * POST /api/public/messages — resposta do denunciante à equipe.
 *
 * No protótipo o botão "Enviar resposta" só mudava um estado local: o texto
 * nunca saía do navegador. Aqui vira uma linha de `report_messages` com
 * `author_type = 'reporter'`, `author_id = null` (não há usuário: é o canal
 * anônimo) e `internal = false`.
 *
 * Só o cookie autoriza — a chave não trafega de novo.
 */

/** Por sessão/relato, não por IP: quem responde é sempre a mesma pessoa. */
const RATE_LIMIT = 10;
const RATE_WINDOW = "00:10:00";

export async function POST(request: Request): Promise<Response> {
  const session = sessionFrom(request);
  if (!session) return sessionRequired();

  const supabase = createAdminClient();

  // FAIL CLOSED, como em /api/public/track e ao contrário do envio do relato:
  // esta rota já exige um cookie válido, então recusar em caso de erro do balde
  // não fecha o canal de denúncia para ninguém — apenas adia uma resposta.
  const consumed = await consumeStrict(
    supabase,
    "reporter_message",
    session.reportId,
    RATE_LIMIT,
    RATE_WINDOW,
  );
  if (consumed === "unavailable") {
    return Response.json(
      { error: "track_unavailable", message: TRACK_UNAVAILABLE },
      { status: 503, headers: NO_STORE },
    );
  }
  if (consumed === "limited") {
    return Response.json(
      {
        error: "rate_limited",
        message: "Muitas mensagens seguidas. Aguarde alguns minutos e tente de novo.",
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

  const parsed = reporterMessageSchema.safeParse(raw);
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
    return Response.json(
      { error: "track_unavailable", message: TRACK_UNAVAILABLE },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!report) return sessionRequired();

  if (isClosed(report.status)) {
    return Response.json(
      {
        error: "report_closed",
        message:
          "Este caso já foi encerrado e não recebe novas mensagens. " +
          "Se houver fato novo, registre um novo relato.",
      },
      { status: 409, headers: NO_STORE },
    );
  }

  const { data: created, error } = await supabase
    .from("report_messages")
    .insert({
      org_id: report.org_id,
      report_id: report.id,
      author_type: "reporter",
      author_id: null,
      internal: false,
      body: parsed.data.body,
    })
    .select("id, author_type, body, created_at")
    .single();

  if (error || !created) {
    console.error("[messages] insert: %s", error?.message ?? "sem dados");
    return Response.json(
      { error: "track_unavailable", message: TRACK_UNAVAILABLE },
      { status: 503, headers: NO_STORE },
    );
  }

  await recordAudit(supabase, {
    orgId: report.org_id,
    reportId: report.id,
    entityType: "report_message",
    entityId: created.id,
    action: "reporter.message_sent",
    actorType: "reporter",
    // Só o tamanho. O corpo da mensagem jamais entra na trilha: ela é lida por
    // toda a equipe da organização e é imutável.
    details: { body_length: parsed.data.body.length },
    ipHash: hashKey(clientIp(request)),
    userAgentHash: userAgentHash(request),
  });

  const message: TrackedMessage = {
    id: created.id,
    authorType: created.author_type,
    body: created.body,
    createdAt: created.created_at,
  };

  return jsonWithSession({ message }, report.id, session.sessionStart, 201);
}
