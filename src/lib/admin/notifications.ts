import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { INVESTIGATION_PATH } from "@/lib/admin/investigacoes";
import { PLAN_PATH } from "@/lib/admin/planos";

export type Notification = Pick<
  Database["public"]["Tables"]["notifications"]["Row"],
  "id" | "kind" | "title" | "body" | "report_id" | "read_at" | "created_at" | "entity_type" | "entity_id"
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
    .select("id, kind, title, body, report_id, entity_type, entity_id, read_at, created_at")
    .order("read_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[notificações] listagem: %s", error.message);
    return [];
  }
  return data ?? [];
});

/**
 * Para onde uma notificação leva, ou `null` quando não há destino (ex.:
 * um aviso de papel amplo sem entidade única associada).
 *
 * `report_id` é o destino mais específico e continua tendo prioridade — mas
 * várias notificações por-pessoa (investigação, medida de prevenção) chegam
 * com `report_id` nulo e só carregavam `entity_type`/`entity_id`, colunas que
 * já existiam na tabela mas nenhuma tela lia: o item aparecia na caixa de
 * avisos sem nenhum link, um beco sem saída. `medidas` não tem página
 * própria — abre o plano dono dela, na aba "Medidas", com a medida indicada
 * via query string (mesmo formato de `measureHref`, mas sem depender de um
 * `PlanFilters` completo, que a caixa de notificações não tem).
 */
export function notificationHref(
  n: Pick<Notification, "report_id" | "entity_type" | "entity_id">,
  measurePlanIds: Record<string, string>,
): string | null {
  if (n.report_id) return `/admin/denuncias/${n.report_id}`;
  if (!n.entity_id) return null;

  switch (n.entity_type) {
    case "investigation":
      return `${INVESTIGATION_PATH}/${n.entity_id}`;
    case "action_plan":
      return `${PLAN_PATH}/${n.entity_id}`;
    case "action_measure": {
      const planId = measurePlanIds[n.entity_id];
      return planId ? `${PLAN_PATH}/${planId}?aba=medidas&medida=${n.entity_id}` : null;
    }
    default:
      return null;
  }
}

/** `action_plan_id` de cada medida referenciada por notificações, para `notificationHref`. */
export async function loadMeasurePlanIds(notifications: Notification[]): Promise<Record<string, string>> {
  const measureIds = notifications
    .filter(n => !n.report_id && n.entity_type === "action_measure" && n.entity_id)
    .map(n => n.entity_id as string);
  if (measureIds.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("action_measures")
    .select("id, action_plan_id")
    .in("id", measureIds);

  if (error) {
    console.error("[notificações] resolução de medida→plano: %s", error.message);
    return {};
  }
  return Object.fromEntries((data ?? []).map(row => [row.id, row.action_plan_id]));
}
