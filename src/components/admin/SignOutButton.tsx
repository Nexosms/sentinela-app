"use client";

import { signOut } from "@/lib/auth/actions";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="sidebar-link" type="submit">
        ⏻ Sair da conta
      </button>
    </form>
  );
}
