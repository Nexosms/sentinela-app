import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { publicEnv } from "@/lib/env";

/**
 * Renova a sessão do Supabase e devolve o usuário validado.
 *
 * A resposta devolvida aqui é a MESMA em que os cookies foram escritos. Quem
 * chama precisa devolvê-la ao Next; criar outra NextResponse faz a sessão
 * silenciosamente parar de renovar — é o erro nº 1 com @supabase/ssr.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getUser(), nunca getSession(): o segundo lê um cookie que não foi validado
  // contra o servidor de auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
