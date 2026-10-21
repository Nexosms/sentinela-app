import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/lib/supabase/database.types";
import {
  calcularCategorias,
  calcularIndicadores,
  calcularSerie,
  calcularTempos,
  type LinhaCategoria,
  type LinhaMetrica,
} from "@/lib/admin/relatorioMensalCalculo";
import {
  MONTHLY_KIND,
  MONTHLY_VERSION,
  formatCnpj,
  limitesDoMes,
  monthlyMetricsSchema,
  somarMeses,
  type MonthlyMetrics,
} from "@/lib/admin/relatorioMensalTipos";

/**
 * Gera o relatório mensal de UMA empresa e o guarda como rascunho.
 *
 * Quem chama passa o cliente com a chave de serviço (o cron e as ações da
 * Nexo); este módulo não importa `supabase/admin`. A chave de serviço passa por
 * cima da RLS, então TODA consulta aqui carrega `.eq("org_id", orgId)`.
 *
 * Por que service role: o Comitê (quem de fato lê o relatório) não enxerga
 * `reports` pela RLS, e as funções `rel_*` são SECURITY INVOKER — no login dele
 * dariam zero. O relatório é calculado uma vez pelo sistema e congelado; o
 * cliente só lê o que a Nexo publicou.
 *
 * Os contadores vêm de `v_report_metrics` / `v_category_distribution` (as mesmas
 * views da Visão geral e dos relatórios) e a proteção de célula pequena é
 * aplicada em `relatorioMensalCalculo.ts` ANTES de gravar. Nada daqui lê
 * protocolo, descrição, envolvidos ou qualquer dado de quem relatou.
 */

export type AdminClient = SupabaseClient<Database>;

const PAGINA = 1000;

/** PostgREST devolve no máximo 1000 linhas por chamada; as views agrupadas podem passar disso. */
async function lerTudo<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  contexto: string,
): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await consulta(de, de + PAGINA - 1);
    if (error) {
      console.error("[relatório mensal] %s: %s", contexto, error.message);
      throw new Error(`relatorio_mensal:${contexto}`);
    }
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return linhas;
  }
}

const slaSchema = z.object({
  sla_triagem_horas: z.number(),
  sla_apuracao_horas: z.number(),
  geral: z.object({
    triados: z.number().nullable(),
    encerrados: z.number().nullable(),
    triagem_no_prazo: z.number().nullable(),
    conclusao_no_prazo: z.number().nullable(),
    mediana_triagem_h: z.number().nullable(),
    mediana_conclusao_h: z.number().nullable(),
  }),
});

export async function gerarRelatorioMensal(
  admin: AdminClient,
  orgId: string,
  mes: string,
  agora: Date = new Date(),
): Promise<MonthlyMetrics> {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("trade_name, cnpj, min_cell_size")
    .eq("id", orgId)
    .maybeSingle();
  if (orgError || !org) {
    console.error("[relatório mensal] empresa: %s", orgError?.message ?? "não encontrada");
    throw new Error("relatorio_mensal:empresa");
  }

  const primeiro = somarMeses(mes, -12);
  const anterior = somarMeses(mes, -1);
  const meses12 = Array.from({ length: 12 }, (_, i) => somarMeses(mes, i - 11));

  const linhas = await lerTudo<LinhaMetrica>(
    (de, ate) =>
      admin
        .from("v_report_metrics")
        .select("period_month, status, risk, total, anonimos, urgentes, alto_risco")
        .eq("org_id", orgId)
        .gte("period_month", `${primeiro}-01`)
        .lte("period_month", `${mes}-01`)
        .order("period_month")
        .range(de, ate) as unknown as PromiseLike<{ data: LinhaMetrica[] | null; error: { message: string } | null }>,
    "metricas",
  );

  const categorias = await lerTudo<LinhaCategoria>(
    (de, ate) =>
      admin
        .from("v_category_distribution")
        .select("period_month, label_pt, group_key, total")
        .eq("org_id", orgId)
        .eq("period_month", `${mes}-01`)
        .order("label_pt")
        .range(de, ate) as unknown as PromiseLike<{ data: LinhaCategoria[] | null; error: { message: string } | null }>,
    "categorias",
  );

  const doMes = (alvo: string) => linhas.filter(l => l.period_month.slice(0, 7) === alvo);
  const minimo = org.min_cell_size;

  // `rel_sla` é a mesma função do painel (SECURITY INVOKER): com a chave de
  // serviço enxerga a empresa inteira, e já devolve cada célula suprimida.
  const { data: slaBruto, error: slaError } = await (
    admin as unknown as {
      rpc(
        fn: "rel_sla",
        args: { p_org: string; p_from: string; p_to: string; p_unit: null },
      ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
    }
  ).rpc("rel_sla", { p_org: orgId, p_from: `${mes}-01`, p_to: `${mes}-01`, p_unit: null });
  if (slaError) {
    console.error("[relatório mensal] rel_sla: %s", slaError.message);
    throw new Error("relatorio_mensal:sla");
  }

  return monthlyMetricsSchema.parse({
    versao: MONTHLY_VERSION,
    mes,
    geradoEm: agora.toISOString(),
    empresa: { nome: org.trade_name, cnpj: formatCnpj(org.cnpj) },
    minimo,
    atual: calcularIndicadores(doMes(mes), minimo),
    anterior: calcularIndicadores(doMes(anterior), minimo),
    serie: calcularSerie(linhas, meses12),
    categorias: calcularCategorias(categorias, minimo),
    tempos: calcularTempos(slaSchema.parse(slaBruto)),
  });
}

/** Slug da organização da própria equipe: ela não é cliente e não ganha relatório. */
const SLUG_NEXO = "sentinela";

export type EmpresaCliente = { id: string; nome: string; ativa: boolean };

/** Empresas-cliente (todas menos a organização da Nexo), ativas primeiro, por nome. */
export async function listarEmpresasCliente(admin: AdminClient): Promise<EmpresaCliente[]> {
  const { data, error } = await admin
    .from("organizations")
    .select("id, trade_name, is_active")
    .neq("slug", SLUG_NEXO)
    .order("trade_name");
  if (error) {
    console.error("[relatório mensal] listar empresas: %s", error.message);
    throw new Error("relatorio_mensal:empresas");
  }
  return (data ?? [])
    .map(org => ({ id: org.id, nome: org.trade_name, ativa: org.is_active }))
    .sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export type ResultadoGravacao =
  | { ok: true; id: string; criado: boolean }
  | { ok: false; motivo: "publicado" | "erro" };

/**
 * Grava (ou regrava) o rascunho do mês. Um relatório já PUBLICADO não é
 * sobrescrito: o cliente pode já tê-lo aberto ou impresso, e os números dele
 * não mudam por baixo. Para refazer, a Nexo oculta primeiro.
 */
export async function gravarRascunho(
  admin: AdminClient,
  orgId: string,
  metrics: MonthlyMetrics,
  geradoPor: string | null,
): Promise<ResultadoGravacao> {
  const { inicio, fim } = limitesDoMes(metrics.mes);

  const { data: existente, error: leituraError } = await admin
    .from("report_snapshots")
    .select("id, is_published")
    .eq("org_id", orgId)
    .eq("kind", MONTHLY_KIND)
    .eq("period_start", inicio)
    .eq("period_end", fim)
    .maybeSingle();
  if (leituraError) {
    console.error("[relatório mensal] ler rascunho: %s", leituraError.message);
    return { ok: false, motivo: "erro" };
  }

  if (existente) {
    if (existente.is_published) return { ok: false, motivo: "publicado" };
    const { data, error } = await admin
      .from("report_snapshots")
      .update({ metrics, generated_by: geradoPor })
      .eq("id", existente.id)
      .eq("org_id", orgId)
      .eq("is_published", false)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      console.error("[relatório mensal] atualizar rascunho: %s", error?.message ?? "sem retorno");
      return { ok: false, motivo: "erro" };
    }
    return { ok: true, id: data.id, criado: false };
  }

  const { data, error } = await admin
    .from("report_snapshots")
    .insert({
      org_id: orgId,
      kind: MONTHLY_KIND,
      period_start: inicio,
      period_end: fim,
      metrics,
      generated_by: geradoPor,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    console.error("[relatório mensal] inserir rascunho: %s", error?.message ?? "sem retorno");
    return { ok: false, motivo: "erro" };
  }
  return { ok: true, id: data.id, criado: true };
}
