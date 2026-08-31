import { createAdminClient } from "@/lib/supabase/admin";
import { TRACK_UNAVAILABLE } from "@/lib/report/tracking";
import { buildTrackedCase } from "@/app/api/public/_lib/tracked-case";
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
 * GET /api/public/track/case — o mesmo `TrackedCase`, só com o cookie.
 *
 * Serve para a tela se atualizar depois de enviar uma mensagem ou anexar um
 * arquivo, sem refazer o scrypt de 32 MB (≈100 ms de CPU) a cada vez. Não
 * aceita protocolo nem chave: quem não tem cookie válido volta para o
 * formulário.
 */

export async function GET(request: Request): Promise<Response> {
  const session = sessionFrom(request);
  if (!session) return sessionRequired();

  const supabase = createAdminClient();

  let report;
  try {
    report = await loadTrackedReport(supabase, session.reportId);
  } catch {
    return Response.json(
      { error: "track_unavailable", message: TRACK_UNAVAILABLE },
      { status: 503, headers: NO_STORE },
    );
  }

  // O cookie é autêntico mas o relato sumiu (expurgo, retenção). Mesma resposta
  // de cookie inválido: nada aqui confirma o que existe no banco.
  if (!report) return sessionRequired();

  let body;
  try {
    body = await buildTrackedCase(supabase, report);
  } catch (err) {
    console.error("[track/case] montagem do caso: %s", err instanceof Error ? err.message : err);
    return Response.json(
      { error: "track_unavailable", message: TRACK_UNAVAILABLE },
      { status: 503, headers: NO_STORE },
    );
  }

  return jsonWithSession(body, report.id, session.sessionStart, 200);
}
