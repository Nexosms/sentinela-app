import Link from "next/link";
import Brand from "@/components/brand/Brand";
import AdminNavLinks, { type NavItem } from "./AdminNavLinks";
import SignOutButton from "./SignOutButton";
import { roleLabel, type AppRole } from "@/lib/org/context";
import { NAV_ITEMS, CONFIGURACOES_ITEM, isNavVisible, type NavOverrides } from "@/lib/admin/navItems";

const SIDEBAR_ITEMS = NAV_ITEMS.filter(entry => entry.key !== "configuracoes");

export default function AdminSidebar({
  orgName,
  fullName,
  email,
  role,
  pendingCount,
  navOverrides,
}: {
  orgName: string;
  fullName: string;
  email: string;
  role: AppRole;
  pendingCount: number;
  navOverrides: NavOverrides;
}) {
  const items: NavItem[] = SIDEBAR_ITEMS.filter(entry => isNavVisible(role, entry, navOverrides)).map(entry => {
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
        {isNavVisible(role, CONFIGURACOES_ITEM, navOverrides) ? (
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
