import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Notification = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "kind" | "title" | "body" | "report_id" | "read_at" | "created_at"
>;

/**
 * Notificações não lidas do usuário.
 *
 * Não há filtro de destinatário aqui de propósito: a policy de SELECT já
 * entrega exatamente as minhas (`user_id = auth.uid()`) e as do meu papel
 * (`user_id is null` e o papel em `target_roles`). Repetir isso em JS seria uma
 * segunda autorização para sair de sincronia com a primeira.
 *
 * `cache` deduplica dentro da requisição: o topbar de cada página e a própria
 * página de notificações compartilham uma consulta só.
 */
export const countUnreadNotifications = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    // Um sino errado não pode derrubar o painel inteiro.
    console.error("[notificações] contagem: %s", error.message);
    return 0;
  }
  return count ?? 0;
});

/** Últimas notificações visíveis ao usuário, não lidas primeiro. */
export const listNotifications = cache(async (limit = 50): Promise<Notification[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, report_id, read_at, created_at")
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notificações] listagem: %s", error.message);
    return [];
  }
  return data ?? [];
});
