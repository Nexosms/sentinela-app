"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: string; badge?: number };

export default function AdminNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav>
      {items.map(item => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : ""}>
            <span>{item.icon}</span>
            {item.label}
            {item.badge ? <b>{item.badge}</b> : null}
          </Link>
        );
      })}
    </nav>
  );
}
