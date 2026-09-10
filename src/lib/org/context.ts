import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import type { NavOverrides } from "@/lib/admin/navItems";

export type AppRole = Database["public"]["Enums"]["app_role"];

export type StaffContext = {
  userId: string;
  fullName: string;
  email: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  role: AppRole;
};

/** Nome do cookie que guarda qual organização `getStaffContext()` resolve,
 *  para quem (hoje só a equipe Nexo) tem mais de um vínculo ativo. */
export const ACTIVE_ORG_COOKIE = "active_org";

/**
 * Contexto do membro logado. `cache` deduplica dentro de uma mesma requisição,
 * então layout e página compartilham uma única consulta.
 *
 * Isto resolve a NAVEGAÇÃO e a exibição. A autorização de verdade é a RLS —
 * nunca decida acesso a dado só com base no papel devolvido aqui.
 *
 * Quem tem só um vínculo ativo (o caso normal, qualquer equipe cliente) nunca
 * nota o cookie `active_org` — a segunda consulta abaixo só existe para quem
 * tem mais de um (a equipe Nexo, admin em várias organizações-cliente).
 */
export const getStaffContext = cache(async (): Promise<StaffContext> => {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const select =
    "role, org_id, organizations(slug, trade_name), profiles!org_members_user_id_fkey(full_name, email)";

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  let data = null;
  if (activeOrgId) {
    ({ data } = await supabase
      .from("org_members")
      .select(select)
      .eq("user_id", user.id)
      .eq("org_id", activeOrgId)
      .eq("status", "active")
      .maybeSingle());
  }

  // Sem cookie, ou cookie apontando para um vínculo que não existe mais
  // (revogado, ou nunca existiu): cai no comportamento de sempre, a primeira
  // organização ativa encontrada.
  if (!data) {
    ({ data } = await supabase
      .from("org_members")
      .select(select)
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle());
  }

  if (!data || !data.organizations || !data.profiles) {
    // Autenticado mas sem vínculo ativo: conta convidada e revogada, ou
    // convite ainda não processado.
    redirect("/sem-acesso");
  }

  return {
    userId: user.id,
    fullName: data.profiles.full_name,
    email: data.profiles.email,
    orgId: data.org_id,
    orgSlug: data.organizations.slug,
    orgName: data.organizations.trade_name,
    role: data.role,
  };
});

export type MyOrganization = { orgId: string; slug: string; tradeName: string; role: AppRole };

/**
 * Todas as organizações onde o usuário atual tem vínculo ativo — alimenta o
 * seletor de organização na sidebar. Para a esmagadora maioria (uma pessoa,
 * uma organização) devolve uma lista de 1, e o seletor não aparece.
 */
export const listMyOrganizations = cache(async (): Promise<MyOrganization[]> => {
  const user = await getAuthenticatedUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(slug, trade_name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  return (data ?? [])
    .filter(row => row.organizations)
    .map(row => ({
      orgId: row.org_id,
      slug: row.organizations!.slug,
      tradeName: row.organizations!.trade_name,
      role: row.role,
    }));
});

/**
 * Quem é Administração da organização "Sentinela" (`publicEnv.defaultOrgSlug`)
 * conta como equipe Nexo — sem tabela nem papel novo, só esta checagem direta.
 * Não depende de qual organização `getStaffContext()` resolveu mostrar,
 * porque decide algo diferente (acesso à tela de cadastrar clientes, não
 * navegação dentro de uma organização).
 */
export const isNexoAdmin = cache(async (): Promise<boolean> => {
  const user = await getAuthenticatedUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", publicEnv.defaultOrgSlug)
    .maybeSingle();
  if (!org) return false;

  const { data } = await supabase
    .from("org_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", org.id)
    .eq("status", "active")
    .eq("role", "admin")
    .maybeSingle();

  return !!data;
});

/**
 * Sobreposições de `role_nav_permissions` da organização, como
 * `{ triagem: { relatorios: false } }`. `cache()` pelo mesmo motivo de
 * `getStaffContext`: `admin/layout.tsx` (sidebar) e
 * `admin/configuracoes/page.tsx` (gate da própria aba) pedem isto na mesma
 * requisição.
 *
 * Sem nenhuma linha na tabela — organização nova, ou que nunca abriu "Time e
 * permissões" — devolve `{}`, e `isNavVisible()` cai no `defaultRoles` de
 * cada item: o comportamento de hoje, sem exceção.
 */
export const getRoleNavOverrides = cache(async (orgId: string): Promise<NavOverrides> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_nav_permissions")
    .select("role, nav_key, visible")
    .eq("org_id", orgId);

  const overrides: NavOverrides = {};
  for (const row of data ?? []) {
    const porCargo = (overrides[row.role] ??= {});
    porCargo[row.nav_key] = row.visible;
  }
  return overrides;
});

/**
 * Reexportados de `@/lib/admin/labels`, que NÃO tem `server-only`.
 *
 * Estes três são funções puras sobre um enum, mas moravam aqui — e este módulo
 * começa com `import "server-only"`. Qualquer client component que importasse
 * `roleLabel` daqui arrastava `server-only` para o bundle do navegador e
 * derrubava o build de produção. O sintoma não aparece em build local com cache
 * do `.next`: só na Vercel, que builda limpo.
 *
 * Em client component, importe de `@/lib/admin/labels` diretamente.
 */
export { hasAnyRole, roleLabel, ROLE_ORDER_RANK as ROLE_RANK } from "@/lib/admin/labels";
