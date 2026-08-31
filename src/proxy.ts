import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

/**
 * No Next 16 o antigo `middleware` chama-se `proxy` e roda no runtime Node.
 *
 * Faz AUTENTICAÇÃO apenas, nunca autorização. Papel é verificado em
 * src/app/admin/layout.tsx e, decisivamente, nas políticas de RLS. O proxy roda
 * fora do runtime principal da aplicação e não deve carregar regra de negócio.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin") && !user) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Tudo, menos estáticos e imagens. As rotas públicas passam por aqui só
    // para renovar a sessão de quem já está logado; o denunciante não tem
    // sessão nenhuma e o custo é uma leitura de cookie ausente.
    "/((?!_next/static|_next/image|favicon.svg|og.jpg|robots.txt|.*\\.(?:svg|png|jpg|jpeg|webp|gif)$).*)",
  ],
};
