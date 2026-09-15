"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Quando o Supabase Auth rejeita um link (expirado, já usado, ou o
 * `redirectTo` fora da lista de Redirect URLs do projeto), ele devolve a
 * pessoa para a "Site URL" configurada no painel — que pode ser a raiz do
 * site, não `/convite` — com o erro no fragmento da URL
 * (`#error=access_denied&error_description=...`). Só `/convite`
 * (`ConviteClient.tsx`) sabe transformar isso numa mensagem legível; em
 * qualquer outra página o fragmento passava batido e a pessoa via uma URL
 * confusa sem explicação. Este componente, montado uma vez no layout raiz,
 * é a rede de segurança: manda o fragmento para `/convite` de onde quer que
 * ele apareça.
 */
export default function AuthErrorRedirect() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === "/convite") return; // lá quem trata é o ConviteClient
    if (!window.location.hash.includes("error=")) return;
    router.replace(`/convite${window.location.hash}`);
  }, [pathname, router]);

  return null;
}
