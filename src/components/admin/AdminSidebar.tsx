import Link from "next/link";

import Brand from "@/components/brand/Brand";
import { formatDocumento } from "@/lib/admin/configuracoes";
import {
  CONFIGURACOES_ITEM,
  NAV_ITEMS,
  isNavVisible,
  type NavOverrides,
} from "@/lib/admin/navItems";
import { publicEnv } from "@/lib/env";
import { roleLabel, type AppRole, type MyOrganization } from "@/lib/org/context";

import AdminNavLinks, { type NavGroup, type NavItem } from "./AdminNavLinks";
import { IconBack, NavIcon } from "./shell/AdminIcons";
import SidebarTenant from "./shell/SidebarTenant";
import SignOutButton from "./SignOutButton";

const BY_KEY = new Map<string, (typeof NAV_ITEMS)[number]>(NAV_ITEMS.map(entry => [entry.key, entry]));

/**
 * Menu lateral. Quem enxerga cada item NÃO mudou: continua sendo `isNavVisible` (papel + grade de
 * permissões de cada organização), exatamente como antes. O que mudou foi o visual (grupos, ícones
 * de linha) e a Central, que só aparece para quem tem acesso a mais de uma empresa.
 */
export default function AdminSidebar({
  orgId,
  orgName,
  fullName,
  email,
  role,
  pendingCount,
  filaCount,
  totalEmpresas,
  hasCentral,
  navOverrides,
  myOrgs,
  nexoAdmin,
}: {
  orgId: string;
  orgName: string;
  fullName: string;
  email: string;
  role: AppRole;
  pendingCount: number;
  /** Itens da Fila do dia (Central). */
  filaCount: number;
  /** Empresas que a Central cobre. */
  totalEmpresas: number;
  hasCentral: boolean;
  navOverrides: NavOverrides;
  myOrgs: MyOrganization[];
  nexoAdmin: boolean;
}) {
  function item(key: string, extra: Partial<NavItem> = {}): NavItem | null {
    const entry = BY_KEY.get(key);
    if (!entry || !isNavVisible(role, entry, navOverrides)) return null;
    return { key, href: entry.href, label: entry.label, ...extra };
  }
  const only = (list: (NavItem | null)[]): NavItem[] => list.filter((value): value is NavItem => value !== null);

  const groups: NavGroup[] = [];

  if (hasCentral) {
    groups.push({
      title: "CENTRAL",
      items: [
        { key: "central", href: "/admin/central", label: "Visão consolidada", exact: true },
        {
          key: "fila",
          href: "/admin/central/fila",
          label: "Fila do dia",
          badge: filaCount > 0 ? filaCount : undefined,
        },
        {
          key: "empresas",
          href: "/admin/central/empresas",
          label: "Empresas",
          badge: totalEmpresas,
          soft: true,
        },
      ],
    });
  }

  groups.push({
    title: hasCentral ? "ESTA ORGANIZAÇÃO" : "PRINCIPAL",
    items: only([
      item("visao-geral"),
      item("denuncias", { badge: pendingCount > 0 ? pendingCount : undefined }),
      item("investigacoes"),
      item("planos-de-acao"),
    ]),
  });

  groups.push({
    title: "GESTÃO",
    items: [
      ...only([item("relatorios"), item("auditoria")]),
      // Telas da equipe Nexo (mexem em dados de todas as empresas); a regra de acesso é a de sempre.
      ...(nexoAdmin
        ? ([
            { key: "relatorios-clientes", href: "/admin/clientes/relatorios", label: "Relatórios dos clientes" },
            { key: "publicar", href: "/admin/clientes/publicar", label: "Publicar para várias empresas" },
          ] satisfies NavItem[])
        : []),
    ],
  });

  groups.push({ title: "PORTAL DO CLIENTE", items: only([item("reunioes"), item("materiais")]) });

  // O seletor não oferece organização desativada — só `/admin/clientes` continua mostrando (e
  // reativando). A organização em que a pessoa já está fica visível mesmo desativada, para nunca
  // sumir o botão de sair.
  const trocaveis = myOrgs.filter(org => org.isActive || org.orgId === orgId);
  const orgDoc = myOrgs.find(org => org.orgId === orgId)?.cnpj ?? null;

  const initials = fullName
    .split(" ")
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="ad-sidebar" id="ad-sidebar" aria-label="Menu do painel">
      <Brand />
      <SidebarTenant
        orgName={orgName}
        roleText={roleLabel(role)}
        doc={formatDocumento(orgDoc)}
        orgs={trocaveis}
        activeOrgId={orgId}
        pinnedSlug={publicEnv.defaultOrgSlug}
        central={
          hasCentral
            ? nexoAdmin
              ? { titulo: "Sentinela · Equipe Nexo", subtitulo: "Todas as empresas" }
              : { titulo: "Central · Minhas empresas", subtitulo: `${totalEmpresas} empresas` }
            : null
        }
      />
      <AdminNavLinks groups={groups} />
      <div className="ad-bottom">
        <div className="ad-links">
          {nexoAdmin ? (
            <Link className="ad-item" href="/admin/clientes">
              <NavIcon name="clientes" />
              <span className="ad-item-label">Clientes</span>
            </Link>
          ) : null}
          {isNavVisible(role, CONFIGURACOES_ITEM, navOverrides) ? (
            <Link className="ad-item" href="/admin/configuracoes">
              <NavIcon name="configuracoes" />
              <span className="ad-item-label">Configurações</span>
            </Link>
          ) : null}
          <Link className="ad-item" href="/">
            <IconBack />
            <span className="ad-item-label">Voltar ao canal público</span>
          </Link>
        </div>
        <div className="ad-user">
          <span className="ad-av ad-av-user" aria-hidden="true">
            {initials}
          </span>
          <span className="ad-user-tx">
            <strong>{fullName}</strong>
            <small>{email}</small>
          </span>
          <SignOutButton variant="icon" />
        </div>
      </div>
    </aside>
  );
}
