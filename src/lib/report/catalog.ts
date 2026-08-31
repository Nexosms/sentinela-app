import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

/**
 * Catálogo público do formulário de relato: unidades da organização e
 * categorias globais.
 *
 * Por que o cliente de serviço e não `@/lib/supabase/server`: o denunciante não
 * tem sessão, e `anon` não tem GRANT nenhum no schema `public` — a consulta sob
 * RLS falharia antes mesmo de chegar a uma policy. A leitura aqui é
 * deliberadamente estreita (duas tabelas, só colunas de rótulo, filtradas pela
 * organização do slug público) e não recebe nenhuma entrada do usuário.
 */

export type OrgUnitOption = {
  id: string;
  /** Rótulo exibido, no formato do protótipo: "Matriz · São Paulo". */
  label: string;
};

export type CategoryOption = {
  id: string;
  code: string;
  label: string;
  groupKey: string;
  requiresSpecification: boolean;
};

export type ReportCatalog = {
  units: OrgUnitOption[];
  categories: CategoryOption[];
};

export async function loadReportCatalog(
  orgSlug: string = publicEnv.defaultOrgSlug,
): Promise<ReportCatalog> {
  const supabase = createAdminClient();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();

  if (orgError) throw new Error(`Falha ao carregar a organização: ${orgError.message}`);
  if (!org) throw new Error(`Organização "${orgSlug}" não encontrada.`);

  const [unitsResult, categoriesResult] = await Promise.all([
    supabase
      .from("org_units")
      .select("id, name, city, state_uf")
      // Escopo de organização explícito: a RLS está fora neste cliente.
      .eq("org_id", org.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("categories")
      .select("id, code, label_pt, group_key, requires_specification")
      .is("org_id", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
  ]);

  if (unitsResult.error) {
    throw new Error(`Falha ao carregar as unidades: ${unitsResult.error.message}`);
  }
  if (categoriesResult.error) {
    throw new Error(`Falha ao carregar as categorias: ${categoriesResult.error.message}`);
  }

  return {
    units: (unitsResult.data ?? []).map(unit => ({
      id: unit.id,
      label: unit.city ? `${unit.name} · ${unit.city}` : unit.name,
    })),
    categories: (categoriesResult.data ?? []).map(category => ({
      id: category.id,
      code: category.code,
      label: category.label_pt,
      groupKey: category.group_key,
      requiresSpecification: category.requires_specification,
    })),
  };
}
