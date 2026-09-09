import "server-only";

import { z } from "zod";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Catálogo público do formulário de relato: unidades da organização e
 * categorias globais.
 *
 * O denunciante não tem sessão e `anon` não tem GRANT no schema `public`, então
 * as tabelas não podem ser lidas direto. A leitura passa por
 * `public.get_report_catalog(p_org_slug)` (migração 020), uma função executável
 * por `anon` que devolve apenas rótulos. Assim a service role fica confinada às
 * rotas de escrita em `api/public/**` e nunca entra no caminho de renderização.
 */

const catalogSchema = z.object({
  org: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    legal_name: z.string(),
    cnpj: z.string().nullable(),
  }),
  units: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      city: z.string().nullable(),
      state_uf: z.string().nullable(),
    }),
  ),
  categories: z.array(
    z.object({
      id: z.uuid(),
      code: z.string(),
      label_pt: z.string(),
      group_key: z.string(),
      requires_specification: z.boolean(),
    }),
  ),
});

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
  orgSlug: string;
  orgName: string;
  /** CNPJ já formatado (`00.000.000/0000-00`), ou `null` se a organização não tiver um cadastrado. */
  orgCnpjFormatted: string | null;
  units: OrgUnitOption[];
  categories: CategoryOption[];
};

/** Só para exibição pública. Espelha `formatCnpj` de `lib/admin/configuracoes.ts`,
 *  sem importar dali — o catálogo público não deve depender de código do admin. */
function formatCnpj(digits: string | null): string | null {
  if (!digits || digits.length !== 14) return null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export async function loadReportCatalog(
  orgSlug: string = publicEnv.defaultOrgSlug,
): Promise<ReportCatalog> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_report_catalog", { p_org_slug: orgSlug });

  if (error) throw new Error(`Falha ao carregar o catálogo do relato: ${error.message}`);

  const parsed = catalogSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Catálogo do relato em formato inesperado para "${orgSlug}".`);
  }

  return {
    orgSlug: parsed.data.org.slug,
    orgName: parsed.data.org.legal_name,
    orgCnpjFormatted: formatCnpj(parsed.data.org.cnpj),
    units: parsed.data.units.map(unit => ({
      id: unit.id,
      label: unit.city ? `${unit.name} · ${unit.city}` : unit.name,
    })),
    categories: parsed.data.categories.map(category => ({
      id: category.id,
      code: category.code,
      label: category.label_pt,
      groupKey: category.group_key,
      requiresSpecification: category.requires_specification,
    })),
  };
}
