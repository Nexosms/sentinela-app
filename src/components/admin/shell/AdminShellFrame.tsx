"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type ShellContext = {
  /** Gaveta do menu aberta (só tem efeito no celular). */
  open: boolean;
  setOpen: (value: boolean) => void;
  pathname: string;
};

const Context = createContext<ShellContext>({ open: false, setOpen: () => {}, pathname: "/admin" });

export function useAdminShell(): ShellContext {
  return useContext(Context);
}

/**
 * Moldura do painel: menu lateral + área principal. No celular o menu vira uma gaveta.
 *
 * A gaveta guarda EM QUAL PÁGINA foi aberta, e não um booleano: ao navegar o caminho muda e ela se
 * considera fechada sozinha, sem `setState` dentro de efeito.
 *
 * `pathnameOverride` existe só para a pré-visualização de desenvolvimento (que não passa pelo login);
 * em produção ninguém o informa.
 */
export default function AdminShellFrame({
  sidebar,
  contextBar,
  children,
  pathnameOverride,
}: {
  sidebar: ReactNode;
  contextBar?: ReactNode;
  children: ReactNode;
  pathnameOverride?: string;
}) {
  const real = usePathname();
  const pathname = pathnameOverride ?? real;
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenAt(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const value = useMemo<ShellContext>(
    () => ({ open, setOpen: next => setOpenAt(next ? pathname : null), pathname }),
    [open, pathname],
  );

  return (
    <Context.Provider value={value}>
      <div className={`ad-shell ${open ? "is-open" : ""}`}>
        {sidebar}
        <div className="ad-backdrop" onClick={() => setOpenAt(null)} aria-hidden="true" />
        <main className="ad-main">
          {contextBar}
          {children}
        </main>
      </div>
    </Context.Provider>
  );
}
