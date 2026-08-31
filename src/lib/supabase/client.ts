"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { publicEnv } from "@/lib/env";

/**
 * Cliente de navegador. Usado APENAS por client components com sessão de staff.
 * O fluxo do denunciante nunca passa por aqui: ele não tem sessão, e toda
 * operação dele precisa de rate limit, verificação de chave e auditoria no
 * servidor.
 */
export function createClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
