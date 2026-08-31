import { timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/cleanup-staging — diário, 03:00 (ver vercel.json).
 *
 * Anexos que ninguém reivindicou continuariam no bucket para sempre. Cada um
 * é um documento sobre uma pessoa que decidiu não enviar o relato — apagar é
 * obrigação, não faxina.
 */

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Apaga as linhas expiradas e devolve os caminhos que estavam nelas.
  const { data, error } = await supabase.rpc("expire_upload_tickets");
  if (error) {
    console.error("[cron] expire_upload_tickets: %s", error.message);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const paths = Array.isArray(data) ? data.filter((p): p is string => typeof p === "string") : [];

  let removed = 0;
  // A API do Storage aceita lotes; 100 por chamada evita URLs gigantes.
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data: gone, error: removeError } = await supabase.storage.from("evidence").remove(batch);
    if (removeError) {
      console.error("[cron] remoção de %d objetos: %s", batch.length, removeError.message);
      continue;
    }
    removed += gone?.length ?? 0;
  }

  const { error: pruneError } = await supabase.rpc("prune_rate_limits");
  if (pruneError) console.error("[cron] prune_rate_limits: %s", pruneError.message);

  return Response.json({
    ticketsExpired: paths.length,
    objectsRemoved: removed,
    rateLimitsPruned: !pruneError,
  });
}
