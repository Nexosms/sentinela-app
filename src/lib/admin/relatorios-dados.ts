import "server-only";

import { cache } from "react";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * A camada de consulta dos relatórios. Uma regra a governa:
 *
 * **A supressão de célula pequena acontece no SQL, nunca aqui.**
 *
 * `public.suppress_small_cell(p_org, contagem)` devolve NULL quando a contagem
 * fica abaixo de `organizations.min_cell_size`. As seis funções `public.rel_*`
 * (migração 027) aplicam essa função em cada célula ANTES de montar o JSON, de
 * modo que o número cru de uma célula suprimida nunca sai do Postgres. Se ele
 * chegasse até aqui e fosse escondido no HTML, bastaria abrir o payload do RSC
 * para lê-lo — e o relatório voltaria a ser um vetor de reidentificação.
 *
 * Por isso todo campo de contagem é `number | null`, e o `null` significa
 * "suprimido", não "não carregou".
 *
 * As funções são SECURITY INVOKER e leem as cinco views `security_invoker=on`
 * da migração 014: a RLS do chamador atravessa. `p_org` é filtro e argumento da
 * supressão — não é autorização.
 */

/* ── ponte de tipos com o supabase-js ─────────────────────────────────────── */

const RPC_NAMES = [
  "rel_panorama",
  "rel_sla",
  "rel_desfechos",
  "rel_retaliacao",
  "rel_psicossocial",
  "rel_cipa",
] as const;

type RpcName = (typeof RPC_NAMES)[number];

type RpcArgs = {
  p_org: string;
  /** Primeiro dia do mês inicial (`date`). */
  p_from: string;
  /** Primeiro dia do mês final, inclusive (`date`). */
  p_to: string;
  p_unit: string | null;
};

/**
 * `database.types.ts` é gerado e está congelado nesta leva, então as seis
 * funções da 027 não constam dele. O cast vai no CLIENTE INTEIRO, nunca no
 * método: `const rpc = supabase.rpc` perde o `this` e quebra em runtime
 * (armadilha registrada do projeto).
 */
type RelatorioClient = {
  rpc(
    fn: RpcName,
    args: RpcArgs,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

async function callRelatorio(name: RpcName, args: RpcArgs): Promise<unknown> {
  const supabase = await createClient();
  const client = supabase as unknown as RelatorioClient;
  const { data, error } = await client.rpc(name, args);
  if (error) {
    console.error("[relatórios] %s: %s", name, error.message);
    throw new Error(`relatorio_indisponivel:${name}`);
  }
  return data;
}

/* ── esquemas ─────────────────────────────────────────────────────────────── */

/**
 * `null` aqui é a resposta de `suppress_small_cell`, não ausência de dado.
 * `z.number().nullable()` recusa qualquer outra coisa: se o formato do JSON
 * mudar, o relatório quebra em vez de mostrar um número inventado.
 */
const cell = z.number().nullable();

const rotulado = z.object({ rotulo: z.string(), total: cell });

const panoramaSchema = z.object({
  kpis: z.object({
    total: cell,
    anonimos: cell,
    retaliacao: cell,
    urgentes: cell,
    alto_risco: cell,
    abertos: cell,
    encerrados: cell,
  }),
  taxa_anonimato: cell,
  por_unidade: z.array(z.object({ rotulo: z.string(), total: cell, alto_risco: cell })),
  por_categoria: z.array(
    z.object({ rotulo: z.string(), grupo: z.string(), total: cell, alto_risco: cell }),
  ),
  por_mes: z.array(z.object({ mes: z.string(), total: cell })),
  por_relacao: z.array(rotulado),
  por_situacao: z.array(rotulado),
});

const slaSchema = z.object({
  sla_triagem_horas: z.number(),
  sla_apuracao_horas: z.number(),
  geral: z.object({
    casos: cell,
    triados: cell,
    encerrados: cell,
    atrasados: cell,
    triagem_no_prazo: cell,
    conclusao_no_prazo: cell,
    mediana_triagem_h: cell,
    mediana_conclusao_h: cell,
  }),
  por_risco: z.array(
    z.object({
      rotulo: z.string(),
      casos: cell,
      triagem_no_prazo: cell,
      mediana_triagem_h: cell,
    }),
  ),
  por_unidade: z.array(
    z.object({ rotulo: z.string(), casos: cell, atrasados: cell, mediana_triagem_h: cell }),
  ),
});

const desfechosSchema = z.object({
  encerrados: z.object({ concluidos: cell, arquivados: cell, recebidos: cell }),
  por_situacao: z.array(rotulado),
  inv_desfecho: z.array(rotulado),
  inv_situacao: z.array(rotulado),
  medidas: z.object({
    total: cell,
    concluidas: cell,
    eficazes: cell,
    sem_verificacao: cell,
  }),
});

const retaliacaoSchema = z.object({
  tempos: z.object({
    casos: cell,
    baseline_casos: cell,
    atrasados: cell,
    encerrados: cell,
    mediana_h: cell,
    baseline_mediana_h: cell,
  }),
  protetivas: z.object({ investigacoes_com_medida: cell }),
  por_unidade: z.array(z.object({ rotulo: z.string(), casos: cell })),
  recorrencia: z.array(z.object({ rotulo: z.string(), casos: cell })),
});

const psicossocialSchema = z.object({
  matriz: z.array(
    z.object({
      unidade: z.string(),
      fator: z.string(),
      frequencia: cell,
      severidade: z.string().nullable(),
      tem_plano_ativo: z.boolean(),
    }),
  ),
  fatores: z.array(
    z.object({
      fator: z.string(),
      frequencia: cell,
      severidade: z.string().nullable(),
      tem_plano_ativo: z.boolean(),
      ultimo_relato: z.string().nullable(),
      publicavel: z.boolean(),
    }),
  ),
  cobertura: z.object({
    fatores_criticos: z.number(),
    com_plano: z.number(),
    fatores_suprimidos: z.number(),
    percentual: z.number().nullable(),
  }),
  por_trimestre: z.array(rotulado),
});

const cipaSchema = z.object({
  panorama: panoramaSchema,
  sla: slaSchema,
  desfechos: desfechosSchema,
  retaliacao: retaliacaoSchema,
  psicossocial: psicossocialSchema,
});

export type Panorama = z.infer<typeof panoramaSchema>;
export type Sla = z.infer<typeof slaSchema>;
export type Desfechos = z.infer<typeof desfechosSchema>;
export type Retaliacao = z.infer<typeof retaliacaoSchema>;
export type Psicossocial = z.infer<typeof psicossocialSchema>;
export type Cipa = z.infer<typeof cipaSchema>;

/* ── consultas ────────────────────────────────────────────────────────────── */

export type Recorte = {
  orgId: string;
  /** Mês inicial, `AAAA-MM`. */
  de: string;
  /** Mês final, `AAAA-MM`. */
  ate: string;
  /** `org_units.id`, ou "" para a organização inteira. */
  unidade: string;
};

function args(recorte: Recorte): RpcArgs {
  return {
    p_org: recorte.orgId,
    p_from: `${recorte.de}-01`,
    p_to: `${recorte.ate}-01`,
    p_unit: recorte.unidade || null,
  };
}

/**
 * `cache` deduplica dentro da requisição: a tela e a nota de rodapé pedem o
 * mesmo relatório e custam uma chamada só. A chave é a tupla de argumentos, e é
 * por isso que `Recorte` é achatado em quatro strings.
 */
const fetchOne = cache(async (name: RpcName, ...key: [string, string, string, string]) => {
  const [orgId, de, ate, unidade] = key;
  return callRelatorio(name, args({ orgId, de, ate, unidade }));
});

export async function getPanorama(recorte: Recorte): Promise<Panorama> {
  return panoramaSchema.parse(
    await fetchOne("rel_panorama", recorte.orgId, recorte.de, recorte.ate, recorte.unidade),
  );
}

export async function getSla(recorte: Recorte): Promise<Sla> {
  return slaSchema.parse(
    await fetchOne("rel_sla", recorte.orgId, recorte.de, recorte.ate, recorte.unidade),
  );
}

export async function getDesfechos(recorte: Recorte): Promise<Desfechos> {
  return desfechosSchema.parse(
    await fetchOne("rel_desfechos", recorte.orgId, recorte.de, recorte.ate, recorte.unidade),
  );
}

export async function getRetaliacao(recorte: Recorte): Promise<Retaliacao> {
  return retaliacaoSchema.parse(
    await fetchOne("rel_retaliacao", recorte.orgId, recorte.de, recorte.ate, recorte.unidade),
  );
}

export async function getPsicossocial(recorte: Recorte): Promise<Psicossocial> {
  return psicossocialSchema.parse(
    await fetchOne("rel_psicossocial", recorte.orgId, recorte.de, recorte.ate, recorte.unidade),
  );
}

/**
 * O documento da CIPA vem de UMA chamada que compõe as outras cinco no próprio
 * SQL. Não é economia de round-trip: é a garantia de que o número impresso e
 * levado à reunião é, por construção, o mesmo do relatório de origem.
 */
export async function getCipa(recorte: Recorte): Promise<Cipa> {
  return cipaSchema.parse(
    await fetchOne("rel_cipa", recorte.orgId, recorte.de, recorte.ate, recorte.unidade),
  );
}

/* ── prestação de contas ──────────────────────────────────────────────────── */

export type ExportRow = {
  id: string;
  kind: string;
  format: string;
  filters: unknown;
  row_count: number | null;
  includes_identity: boolean;
  created_at: string;
  autor: string;
};

/**
 * A prestação de contas NÃO passa por supressão: cada linha é o ato de um
 * membro da equipe, não a contagem de pessoas que relataram. Esconder quem
 * exportou seria o oposto do objetivo do relatório.
 *
 * A RLS de `report_exports` já restringe a leitura a `admin` e `comite`
 * (`exports_read`); não há re-filtro por `org_id` aqui.
 */
export async function listExports(limit = 500): Promise<ExportRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_exports")
    .select(
      "id, kind, format, filters, row_count, includes_identity, created_at, profiles!report_exports_requested_by_fkey(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[relatórios] prestação de contas: %s", error.message);
    throw new Error("relatorio_indisponivel:report_exports");
  }

  return (data ?? []).map(row => ({
    id: row.id,
    kind: row.kind,
    format: row.format,
    filters: row.filters,
    row_count: row.row_count,
    includes_identity: row.includes_identity,
    created_at: row.created_at,
    autor: row.profiles?.full_name ?? "Conta removida",
  }));
}

/** Unidades ativas para o `<select>` do filtro. */
export const listUnits = cache(async (): Promise<{ id: string; name: string }[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_units")
    .select("id, name, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(unit => ({ id: unit.id, name: unit.name }));
});

/**
 * `organizations.min_cell_size` — o limiar que `suppress_small_cell()` aplica.
 *
 * Vem para a tela só para a NOTA DE RODAPÉ dizer o número certo ("células com
 * menos de 5 casos"). Nenhuma decisão de exibição depende dele aqui: quem
 * suprime é o SQL, e o componente nunca chega a ver a contagem crua para poder
 * compará-la com o limiar.
 */
export const getMinCellSize = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("min_cell_size").limit(1).maybeSingle();
  return data?.min_cell_size ?? 5;
});
