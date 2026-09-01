import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/sweep-overdue — diário, 04:00 em Brasília (ver vercel.json).
 *
 * `atrasada` é status derivado: ninguém o marca à mão na interface. Quem o
 * deriva é `sweep_overdue()`, no banco, a partir das datas — e é ela também
 * que cobra a verificação de eficácia, a etapa que todo mundo pula e todo
 * auditor pergunta. Rodar duas vezes no mesmo dia é inofensivo: a função é
 * idempotente e não repete notificação ainda não lida.
 */

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** O que `sweep_overdue()` devolve, para o log do cron. */
type SweepResult = {
  ran_for: string;
  measuresMarkedOverdue: number;
  plansMarkedOverdue: number;
  plansReopened: number;
  notifiedOverdue: number;
  notifiedVerifyDue: number;
  notifiedSignoffDue: number;
};

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("sweep_overdue");
  if (error) {
    console.error("[cron] sweep_overdue: %s", error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  // `Returns: Json` nos tipos gerados: o formato de fato é o do SweepResult.
  const resumo = data as SweepResult | null;

  return Response.json({
    ranFor: resumo?.ran_for ?? null,
    measuresMarkedOverdue: resumo?.measuresMarkedOverdue ?? 0,
    plansMarkedOverdue: resumo?.plansMarkedOverdue ?? 0,
    plansReopened: resumo?.plansReopened ?? 0,
    notifiedOverdue: resumo?.notifiedOverdue ?? 0,
    notifiedVerifyDue: resumo?.notifiedVerifyDue ?? 0,
    notifiedSignoffDue: resumo?.notifiedSignoffDue ?? 0,
  });
}
