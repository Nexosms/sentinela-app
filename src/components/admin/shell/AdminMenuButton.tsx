"use client";

import { IconMenu } from "./AdminIcons";
import { useAdminShell } from "./AdminShellFrame";

/** Botão do topo que abre a gaveta do menu (só aparece no celular, via CSS). */
export default function AdminMenuButton() {
  const { open, setOpen } = useAdminShell();
  return (
    <button
      type="button"
      className="ad-ib ad-menu-btn"
      aria-label="Abrir o menu"
      aria-expanded={open}
      aria-controls="ad-sidebar"
      onClick={() => setOpen(!open)}
    >
      <IconMenu />
    </button>
  );
}
