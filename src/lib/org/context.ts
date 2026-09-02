import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
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

/**
 * Contexto do membro logado. `cache` deduplica dentro de uma mesma requisição,
 * então layout e página compartilham uma única consulta.
 *
 * Isto resolve a NAVEGAÇÃO e a exibição. A autorização de verdade é a RLS —
 * nunca decida acesso a dado só com base no papel devolvido aqui.
 */
export const getStaffContext = cache(async (): Promise<StaffContext> => {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_members")
    .select("role, org_id, organizations(slug, trade_name), profiles!org_members_user_id_fkey(full_name, email)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data || !data.organizations || !data.profiles) {
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
