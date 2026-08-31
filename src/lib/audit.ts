import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

/** Cliente service-role. Tipado aqui para não repetir o genérico em cada rota. */
export type AdminClient = SupabaseClient<Database>;

type AuditRow = Database["public"]["Tables"]["audit_events"]["Insert"];

export type AuditInput = {
  orgId: string;
  reportId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  /** "reporter" no fluxo público, "system" no cron. */
  actorType: "reporter" | "system" | "user";
  actorId?: string | null;
  actorLabel?: string | null;
  /**
   * Só referências, contagens e hashes. NUNCA o corpo do relato, o segredo,
   * um IP em claro ou campos de identidade — a trilha é lida por toda a
   * equipe da organização e é imutável (a cadeia de hash impede correção).
   */
  details?: Record<string, Json>;
  /** Já derivado por `hashKey()`; o IP em claro nunca chega até aqui. */
  ipHash?: string | null;
  userAgentHash?: string | null;
};

/**
 * Único lugar que escreve em `audit_events`.
 *
 * `row_hash` é calculado por um trigger BEFORE INSERT (`app.audit_chain`), que
 * também encadeia `prev_hash`. O valor enviado aqui é um placeholder que o
 * trigger sobrescreve — a coluna é NOT NULL, então algo precisa ir no INSERT.
 * Nunca faça UPDATE ou DELETE nesta tabela: quebraria a cadeia.
 *
 * Não lança. A trilha é importante, mas um relato já gravado não pode virar
 * erro 500 por causa dela; a falha é registrada no log do servidor.
 */
export async function recordAudit(
  supabase: AdminClient,
  input: AuditInput,
): Promise<boolean> {
  const row: AuditRow = {
    org_id: input.orgId,
    report_id: input.reportId ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    action: input.action,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    actor_label: input.actorLabel ?? null,
    details: (input.details ?? {}) as Json,
    ip_hash: input.ipHash ?? null,
    user_agent_hash: input.userAgentHash ?? null,
    row_hash: "",
  };

  const { error } = await supabase.from("audit_events").insert(row);
  if (error) {
    console.error("[audit] falha ao gravar %s: %s", input.action, error.message);
    return false;
  }
  return true;
}
