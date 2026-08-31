import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { publicEnv } from "@/lib/env";

/**
 * Cliente com a chave de serviço. PASSA POR CIMA DA RLS.
 *
 * Permitido em exatamente três lugares (imposto por ESLint em
 * eslint.config.mjs):
 *   - src/app/api/public/**        fluxo do denunciante, que não tem sessão
 *   - src/app/api/cron/**          tarefas agendadas
 *   - src/app/api/admin/invites/** provisionamento de usuário
 *
 * Como a RLS está fora, todo uso precisa fazer o escopo de organização
 * explicitamente: `.eq("org_id", orgId)`. Trate cada arquivo que importa isto
 * como crítico de segurança e revise-o como tal.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente. Ver .env.example.");
  }
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
