"use client";

import { useFormStatus } from "react-dom";

import { ExitIcon } from "@/components/public/icons";
import { signOut } from "@/lib/auth/actions";

function PageButton() {
  const { pending } = useFormStatus();
  return (
    <button className="lg-secondary lg-button" type="submit" disabled={pending}>
      <ExitIcon size={19} /> {pending ? "Saindo…" : "Sair da conta"}
    </button>
  );
}

function IconButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="ad-signout"
      type="submit"
      disabled={pending}
      aria-label="Sair da conta"
      title="Sair da conta"
    >
      <ExitIcon size={18} />
    </button>
  );
}

/**
 * `icon` é o botão do cartão do usuário no menu do painel; `page` é o das telas de acesso;
 * `sidebar` é o botão em texto do menu antigo. Nos três casos a saída é a mesma ação do servidor.
 */
export default function SignOutButton({
  variant = "sidebar",
}: {
  variant?: "sidebar" | "page" | "icon";
}) {
  return (
    <form action={signOut} className={variant === "icon" ? "ad-signout-form" : undefined}>
      {variant === "page" ? (
        <PageButton />
      ) : variant === "icon" ? (
        <IconButton />
      ) : (
        <button className="sidebar-link" type="submit">
          ⏻ Sair da conta
        </button>
      )}
    </form>
  );
}
