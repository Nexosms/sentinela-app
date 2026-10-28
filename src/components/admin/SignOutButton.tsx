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

/**
 * `sidebar` é o botão do menu lateral do painel; `page` é o das telas de acesso (visual novo).
 * Nos dois casos a saída é a mesma ação do servidor.
 */
export default function SignOutButton({ variant = "sidebar" }: { variant?: "sidebar" | "page" }) {
  return (
    <form action={signOut}>
      {variant === "page" ? (
        <PageButton />
      ) : (
        <button className="sidebar-link" type="submit">
          ⏻ Sair da conta
        </button>
      )}
    </form>
  );
}
