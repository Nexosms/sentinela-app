import Link from "next/link";
import Brand from "@/components/brand/Brand";
import AdminNavLinks, { type NavItem } from "./AdminNavLinks";
import SignOutButton from "./SignOutButton";
import { hasAnyRole, roleLabel, type AppRole } from "@/lib/org/context";

const ALL_ITEMS: (NavItem & { roles: readonly AppRole[] })[] = [
  { href: "/admin",                 label: "Visão geral",    icon: "⌂", roles: ["admin", "triagem", "investigador", "comite"] },
  { href: "/admin/denuncias",       label: "Denúncias",      icon: "□", roles: ["admin", "triagem", "investigador"] },
  { href: "/admin/investigacoes",   label: "Investigações",  icon: "⌕", roles: ["admin", "triagem", "investigador"] },
  { href: "/admin/planos-de-acao",  label: "Planos de ação", icon: "✓", roles: ["admin", "triagem", "investigador", "comite"] },
  { href: "/admin/relatorios",      label: "Relatórios",     icon: "▤", roles: ["admin", "comite"] },
  { href: "/admin/auditoria",       label: "Auditoria",      icon: "⌁", roles: ["admin", "comite"] },
];

export default function AdminSidebar({
  orgName,
  fullName,
  email,
  role,
  pendingCount,
}: {
  orgName: string;
  fullName: string;
  email: string;
  role: AppRole;
  pendingCount: number;
}) {
  const items: NavItem[] = ALL_ITEMS.filter(entry => hasAnyRole(role, entry.roles)).map(entry => {
    const item: NavItem = { href: entry.href, label: entry.label, icon: entry.icon };
    return item.href === "/admin/denuncias" && pendingCount > 0
      ? { ...item, badge: pendingCount }
      : item;
  });

  const initials = fullName
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const orgInitials = orgName
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="admin-sidebar">
      <Brand />
      <div className="tenant">
        <span>{orgInitials}</span>
        <div>
          <small>{roleLabel(role)}</small>
          <strong>{orgName}</strong>
        </div>
        <b>⌄</b>
      </div>
      <AdminNavLinks items={items} />
      <div className="sidebar-bottom">
        {role === "admin" ? (
          <Link className="sidebar-link" href="/admin/configuracoes">
            ⚙ Configurações
          </Link>
        ) : null}
        <Link className="sidebar-link" href="/">
          ← Voltar ao canal público
        </Link>
        <SignOutButton />
        <div className="admin-user">
          <span>{initials}</span>
          <div>
            <strong>{fullName}</strong>
            <small>{email}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
