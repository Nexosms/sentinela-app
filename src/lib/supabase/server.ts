import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { publicEnv } from "@/lib/env";

/**
 * Cliente de servidor com a sessão do usuário. É o padrão para TODO código de
 * staff — server components, server actions, route handlers do admin — e roda
 * sempre sob RLS.
 *
 * Se uma consulta de staff só funciona com a service key, a política de RLS
 * está errada. Não contorne por aqui.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Chamado de um Server Component: a escrita de cookie é ignorada.
          // O refresh de sessão acontece em proxy.ts, então isso é inofensivo.
        }
      },
    },
  });
}

/**
 * Usuário autenticado e validado contra o servidor de auth.
 * Sempre getUser(), nunca getSession() — o segundo confia num cookie que não
 * foi verificado.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
