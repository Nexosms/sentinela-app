"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

import AccessibilityToggle from "./AccessibilityToggle";
import { CloseIcon, Globe, MenuIcon, Search } from "./icons";

/**
 * Menu do celular: no topo não cabem os links, então eles vão para um painel.
 * Botão com `aria-expanded`, fecha com Esc, com toque fora e ao escolher um item.
 */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const painelId = useId();
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fecharComEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const fecharFora = (event: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", fecharComEsc);
    document.addEventListener("pointerdown", fecharFora);
    return () => {
      document.removeEventListener("keydown", fecharComEsc);
      document.removeEventListener("pointerdown", fecharFora);
    };
  }, [open]);

  return (
    <div className="hm-menu" ref={raiz}>
      <button
        type="button"
        className="hm-menu-btn"
        aria-expanded={open}
        aria-controls={painelId}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        onClick={() => setOpen(value => !value)}
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>
      {open ? (
        <div className="hm-menu-panel" id={painelId} onClick={() => setOpen(false)}>
          <Link href="/acompanhar">
            <Search size={18} /> Acompanhar protocolo
          </Link>
          <AccessibilityToggle />
          <button className="language-button" type="button">
            <Globe size={18} /> Idioma: PT
          </button>
        </div>
      ) : null}
    </div>
  );
}
