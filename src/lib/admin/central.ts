import "server-only";

import { cache } from "react";

import { NAV_ITEMS, isNavVisible } from "@/lib/admin/navItems";
import { estaVencido, entraNaFila, ordenarFila, type FilaItem } from "@/lib/admin/centralFila";
import { getRoleNavOverrides, listMyOrganizations, type MyOrganization } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";

/**
 * Central: visão de todas as empresas a que a pessoa tem acesso.
 *
 * NÃO cria acesso novo. Duas travas, as mesmas do resto do painel:
 *  1. só entram empresas ativas em que o papel da pessoa enxerga "Denúncias" na grade de permissões
 *     (`isNavVisible` — a administração nunca é filtrada, como no menu);
 *  2. toda leitura passa pela RLS, que decide linha a linha o que aparece.
 * Aparece só o necessário para conferir o dia (risco, situação, prazo, responsável): nem o texto do
 * relato nem a identidade de quem relatou saem nesta consulta.
 */

const DENUNCIAS = NAV_ITEMS.find(item => item.key === "denuncias")!;

/** Empresas ativas cujas denúncias a pessoa pode conferir. `cache`: layout e página dividem a consulta. */
export const listarEmpresasDaCentral = cache(async (): Promise<MyOrganization[]> => {
  const ativas = (await listMyOrganizations()).filter(org => org.isActive);

  const liberadas = await Promise.all(
    ativas.map(async org => {
      // Administração ignora a grade: não gasta uma consulta por empresa à toa.
      if (org.role === "admin") return org;
      const overrides = await getRoleNavOverrides(org.orgId);
      return isNavVisible(org.role, DENUNCIAS, overrides) ? org : null;
    }),
  );
  return liberadas.filter((org): org is MyOrganization => org !== null);
});

/** A Central só faz sentido para quem tem mais de uma empresa. */
export async function temCentral(): Promise<boolean> {
  return (await listarEmpresasDaCentral()).length > 1;
}

const ABERTOS = "(concluida,arquivada)";

/**
 * Quantos relatos pedem olhar hoje — o número do menu. Mesma regra de `entraNaFila`, em uma única
 * consulta de contagem (nada é baixado). 0 se a pessoa não tem Central.
 */
export async function contarFilaDoDia(): Promise<number> {
  const empresas = await listarEmpresasDaCentral();
  if (empresas.length < 2) return 0;

  const supabase = await createClient();
  const agora = new Date().toISOString();
  const { count } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .in("org_id", empresas.map(org => org.orgId))
    .not("status", "in", ABERTOS)
    .or(`risk.eq.critico,assigned_to.is.null,status.eq.em_triagem,due_at.lt.${agora}`);
  return count ?? 0;
}

export type EmpresaResumo = {
  orgId: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  abertos: number;
  criticos: number;
  vencidos: number;
  naFila: number;
  ultimaAtividade: string | null;
};

export type CentralDados = {
  agora: Date;
  empresas: EmpresaResumo[];
  fila: FilaItem[];
  kpis: {
    empresasAtivas: number;
    empresasComItens: number;
    abertos: number;
    criticos: number;
    vencidos: number;
  };
};

/** Teto de leitura: a Central é para conferência, não para exportação. Passou disso, avisa na tela. */
export const LIMITE_CENTRAL = 2000;

type LinhaRelato = {
  id: string;
  org_id: string;
  protocol: string;
  status: FilaItem["status"];
  risk: FilaItem["risk"];
  due_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string } | null;
};

export const carregarCentral = cache(async (): Promise<CentralDados & { truncado: boolean }> => {
  const agora = new Date();
  const orgs = await listarEmpresasDaCentral();
  const supabase = await createClient();

  const { data } =
    orgs.length > 0
      ? await supabase
          .from("reports")
          .select(
            "id, org_id, protocol, status, risk, due_at, assigned_to, created_at, updated_at, profiles!reports_assigned_to_fkey(full_name)",
          )
          .in("org_id", orgs.map(org => org.orgId))
          .not("status", "in", ABERTOS)
          .order("created_at", { ascending: false })
          .limit(LIMITE_CENTRAL)
      : { data: [] };

  const linhas = (data ?? []) as unknown as LinhaRelato[];
  const nomePorOrg = new Map(orgs.map(org => [org.orgId, org.tradeName]));

  const todos: FilaItem[] = linhas.map(linha => ({
    id: linha.id,
    orgId: linha.org_id,
    orgName: nomePorOrg.get(linha.org_id) ?? "—",
    protocol: linha.protocol,
    status: linha.status,
    risk: linha.risk,
    dueAt: linha.due_at,
    assignedTo: linha.assigned_to,
    assigneeName: linha.profiles?.full_name ?? null,
    createdAt: linha.created_at,
  }));

  const ultimaPorOrg = new Map<string, string>();
  for (const linha of linhas) {
    const atual = ultimaPorOrg.get(linha.org_id);
    if (!atual || linha.updated_at > atual) ultimaPorOrg.set(linha.org_id, linha.updated_at);
  }

  const fila = ordenarFila(todos.filter(item => entraNaFila(item, agora)));

  const empresas: EmpresaResumo[] = orgs
    .map(org => {
      const dela = todos.filter(item => item.orgId === org.orgId);
      return {
        orgId: org.orgId,
        nome: org.tradeName,
        slug: org.slug,
        cnpj: org.cnpj,
        abertos: dela.length,
        criticos: dela.filter(item => item.risk === "critico").length,
        vencidos: dela.filter(item => estaVencido(item, agora)).length,
        naFila: fila.filter(item => item.orgId === org.orgId).length,
        ultimaAtividade: ultimaPorOrg.get(org.orgId) ?? null,
      };
    })
    // Quem pede mais atenção primeiro; empate: mais abertos, depois ordem alfabética.
    .sort(
      (a, b) =>
        b.criticos - a.criticos ||
        b.vencidos - a.vencidos ||
        b.abertos - a.abertos ||
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }),
    );

  return {
    agora,
    empresas,
    fila,
    truncado: linhas.length >= LIMITE_CENTRAL,
    kpis: {
      empresasAtivas: orgs.length,
      empresasComItens: empresas.filter(empresa => empresa.naFila > 0).length,
      abertos: todos.length,
      criticos: todos.filter(item => item.risk === "critico").length,
      vencidos: todos.filter(item => estaVencido(item, agora)).length,
    },
  };
});
