import type { AppRole } from "@/lib/admin/labels";

/**
 * Itens do menu admin, num só lugar. A sidebar e a grade de permissões (aba
 * "Time e permissões") consomem esta mesma lista — sem isto o rótulo/ícone de
 * cada item viveria duplicado nos dois lugares.
 *
 * `defaultRoles` é exatamente o que `AdminSidebar` tinha hardcoded antes de
 * `role_nav_permissions` existir: o comportamento de uma organização sem
 * nenhuma linha na tabela (todas, hoje) continua idêntico ao de antes.
 */
export const NAV_ITEMS = [
  {
    key: "visao-geral",
    href: "/admin",
    label: "Visão geral",
    icon: "⌂",
    defaultRoles: ["admin", "triagem", "investigador", "comite"],
  },
  {
    key: "denuncias",
    href: "/admin/denuncias",
    label: "Denúncias",
    icon: "□",
    defaultRoles: ["admin", "triagem", "investigador"],
  },
  {
    key: "investigacoes",
    href: "/admin/investigacoes",
    label: "Investigações",
    icon: "⌕",
    defaultRoles: ["admin", "triagem", "investigador"],
  },
  {
    key: "planos-de-acao",
    href: "/admin/planos-de-acao",
    label: "Planos de ação",
    icon: "✓",
    defaultRoles: ["admin", "triagem", "investigador", "comite"],
  },
  {
    key: "relatorios",
    href: "/admin/relatorios",
    label: "Relatórios",
    icon: "▤",
    defaultRoles: ["admin", "comite"],
  },
  {
    key: "auditoria",
    href: "/admin/auditoria",
    label: "Auditoria",
    icon: "⌁",
    defaultRoles: ["admin", "comite"],
  },
  // Portal do Cliente. `configurable: false` tira os dois itens da grade de
  // permissões (e portanto de `role_nav_permissions`, cujo CHECK de `nav_key`
  // só conhece as chaves antigas) e os deixa visíveis a todo papel — o
  // conteúdo já é filtrado por organização e por publicação.
  {
    key: "reunioes",
    href: "/admin/reunioes",
    label: "Minhas Reuniões",
    icon: "◷",
    defaultRoles: ["admin", "triagem", "investigador", "comite"],
    configurable: false,
  },
  {
    key: "materiais",
    href: "/admin/materiais",
    label: "Materiais e Documentos",
    icon: "▣",
    defaultRoles: ["admin", "triagem", "investigador", "comite"],
    configurable: false,
  },
  {
    key: "configuracoes",
    href: "/admin/configuracoes",
    label: "Configurações",
    icon: "⚙",
    defaultRoles: ["admin"],
  },
] as const satisfies readonly {
  key: string;
  href: string;
  label: string;
  icon: string;
  defaultRoles: readonly AppRole[];
  configurable?: boolean;
}[];

export type NavItemKey = (typeof NAV_ITEMS)[number]["key"];
export type NavItemDef = (typeof NAV_ITEMS)[number];

/** Tudo exceto "Visão geral" e o portal: o que a grade de permissões mostra como coluna. */
export const CONFIGURABLE_NAV_ITEMS = NAV_ITEMS.filter(
  (item): item is Exclude<NavItemDef, { key: "visao-geral" | "reunioes" | "materiais" }> =>
    item.key !== "visao-geral" && !("configurable" in item && item.configurable === false),
);

export const CONFIGURACOES_ITEM = NAV_ITEMS.find(item => item.key === "configuracoes")!;

/** `role → nav_key → visible`, só as combinações que fogem do padrão (`defaultRoles`). */
export type NavOverrides = Partial<Record<AppRole, Partial<Record<string, boolean>>>>;

/**
 * Admin nunca é filtrado (bypass deliberado: ninguém pode se trancar fora do
 * próprio painel mexendo nesta grade) e "Visão geral" é sempre visível — sem
 * ela um cargo sem mais nada liberado não teria para onde ir ao entrar.
 */
export function isNavVisible(role: AppRole, item: NavItemDef, overrides: NavOverrides): boolean {
  if (role === "admin" || item.key === "visao-geral") return true;
  if ("configurable" in item && item.configurable === false) return true;
  const override = overrides[role]?.[item.key];
  return override !== undefined ? override : (item.defaultRoles as readonly AppRole[]).includes(role);
}
