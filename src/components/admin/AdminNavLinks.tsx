"use client";

import Link from "next/link";

import { NavIcon } from "./shell/AdminIcons";
import { useAdminShell } from "./shell/AdminShellFrame";

export type NavItem = {
  /** Chave do ícone (a do `NAV_ITEMS` ou uma extra da Central). */
  key: string;
  href: string;
  label: string;
  badge?: number;
  /** Selo discreto (contagem informativa) em vez do vermelho de "pendente". */
  soft?: boolean;
  /** Ativo só no caminho exato (para o item pai de caminhos filhos). */
  exact?: boolean;
};

export type NavGroup = { title: string; items: NavItem[] };

export default function AdminNavLinks({ groups }: { groups: NavGroup[] }) {
  const { pathname } = useAdminShell();

  return (
    <nav className="ad-nav" aria-label="Seções do painel">
      {groups
        .filter(group => group.items.length > 0)
        .map(group => (
          <div className="ad-group" key={group.title}>
            <h3>{group.title}</h3>
            {group.items.map(item => {
              const active =
                item.exact || item.href === "/admin"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`ad-item ${active ? "active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon name={item.key} />
                  <span className="ad-item-label">{item.label}</span>
                  {item.badge ? (
                    <b className={`ad-badge ${item.soft ? "soft" : ""}`}>{item.badge}</b>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
    </nav>
  );
}
