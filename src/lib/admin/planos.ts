import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

/** `action_plans.status` e `action_measures.status` compartilham o mesmo ENUM. */
export type MeasureStatus = Enums["measure_status"];
export type MeasureKind = Enums["measure_kind"];
export type Effectiveness = Enums["effectiveness_result"];
export type CategoryGroup = Enums["category_group"];

/** `risk_source` é `text` com CHECK, não ENUM — a lista vem do CHECK. */
export const RISK_SOURCE = [
  "denuncia",
  "investigacao",
  "inventario_riscos",
  "auditoria",
  "cipa",
  "outro",
] as const;
export type RiskSource = (typeof RISK_SOURCE)[number];

export const PLAN_PATH = "/admin/planos-de-acao";

/** Mesma escala dos outros dois módulos: um dia de trabalho cabe numa página. */
export const PAGE_SIZE = 25;

/** Sugestão de intervalo entre concluir a medida e verificar se ela funcionou. */
export const VERIFY_DEFAULT_DAYS = 30;

export const STATUS_LABEL: Record<MeasureStatus, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  atrasada: "Atrasada",
  cancelada: "Cancelada",
};

export const STATUS_ORDER = [
  "planejada",
  "em_andamento",
  "concluida",
  "atrasada",
  "cancelada",
] as const satisfies readonly MeasureStatus[];

/**
 * ⚠️ `atrasada` NÃO entra em nenhum `<select>`.
 *
 * Quem marca esse estado é `public.sweep_overdue()` (migração 024, chamada pelo
 * cron `/api/cron/sweep-overdue`): ela vira as medidas vencidas, propaga o
 * atraso ao plano e reverte quando a medida é concluída. Se um humano pudesse
 * escolher "atrasada" na tela, o indicador deixaria de significar "venceu" e
 * passaria a significar "alguém achou que estava atrasado" — e o número que a
 * CIPA lê perderia o sentido.
 *
 * `concluida` também fica de fora, mas por outro motivo: `measure_completion_consistency`
 * exige `completed_at` no mesmo UPDATE, então concluir é uma ação própria.
 */
export const SELECTABLE_STATUS = [
  "planejada",
  "em_andamento",
  "cancelada",
] as const satisfies readonly MeasureStatus[];

/** O plano tem o mesmo ENUM, e `concluida` aqui é escolha do responsável. */
export const SELECTABLE_PLAN_STATUS = [
  "planejada",
  "em_andamento",
  "concluida",
  "cancelada",
] as const satisfies readonly MeasureStatus[];

/**
 * Vocabulário da NR-01: são **medidas de prevenção e controle**, não "tarefas".
 * A ordem segue a hierarquia de controle — eliminar a fonte antes de treinar
 * quem convive com ela.
 */
export const KIND_LABEL: Record<MeasureKind, string> = {
  estrutural: "Estrutural — muda a organização do trabalho",
  preventiva: "Preventiva — evita que volte a acontecer",
  corretiva: "Corretiva — corrige o que já ocorreu",
  treinamento: "Treinamento e capacitação",
  comunicacao: "Comunicação e divulgação",
  disciplinar: "Disciplinar — sanção a quem praticou",
};

export const KIND_ORDER = [
  "estrutural",
  "preventiva",
  "corretiva",
  "treinamento",
  "comunicacao",
  "disciplinar",
] as const satisfies readonly MeasureKind[];

export const EFFECTIVENESS_LABEL: Record<Effectiveness, string> = {
  nao_verificada: "Não verificada",
  eficaz: "Eficaz",
  parcialmente_eficaz: "Parcialmente eficaz",
  ineficaz: "Ineficaz",
};

/**
 * O que a pessoa que verifica pode escolher. `nao_verificada` é o estado
 * inicial, não um resultado: `measure_verification_consistency` liga
 * `effectiveness <> 'nao_verificada'` a `verified_at` preenchido.
 */
export const VERDICT_ORDER = [
  "eficaz",
  "parcialmente_eficaz",
  "ineficaz",
] as const satisfies readonly Effectiveness[];

/** Resultado que a NR-01 não aceita como fim de linha: pede novo plano. */
export function needsFollowUp(effectiveness: Effectiveness): boolean {
  return effectiveness === "ineficaz" || effectiveness === "parcialmente_eficaz";
}

export const RISK_SOURCE_LABEL: Record<RiskSource, string> = {
  denuncia: "Denúncia recebida",
  investigacao: "Investigação concluída",
  inventario_riscos: "Inventário de riscos (PGR)",
  auditoria: "Auditoria",
  cipa: "CIPA",
  outro: "Outra origem",
};

export const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  organizacao_trabalho: "Fatores de organização do trabalho (Grupo B)",
  violencia_conduta: "Violência e conduta (Grupo A)",
};

/**
 * O selo de status reusa `.risk`, que só tem quatro variantes de cor. O
 * mapeamento é semântico: `atrasada` é o único estado que a organização está
 * descumprindo, então é o único crítico.
 */
export function planStatusClass(status: MeasureStatus): string {
  const tone: Record<MeasureStatus, string> = {
    planejada: "moderado",
    em_andamento: "alto",
    concluida: "baixo",
    atrasada: "crítico",
    cancelada: "baixo",
  };
  return `risk ${tone[status]}`;
}

export const TABS = [
  { key: "plano", label: "Plano" },
  { key: "medidas", label: "Medidas" },
  { key: "eficacia", label: "Eficácia" },
] as const;

export type PlanTab = (typeof TABS)[number]["key"];

const TAB_KEYS = TABS.map(tab => tab.key) as readonly string[];

/** Em Next 16 `searchParams` chega como Promise; o tipo é o do valor resolvido. */
export type SearchParams = Record<string, string | string[] | undefined>;

export type PlanFilters = {
  q: string;
  status: MeasureStatus | "";
  responsavel: string;
  origem: RiskSource | "";
  pagina: number;
  aba: PlanTab;
  /**
   * Medida aberta para edição. Mora na URL como todo o resto do estado desta
   * tela: assim o painel de edição continua sendo Server Component, o link é
   * compartilhável, e sair da aba fecha o editor sem estado pendurado.
   */
  medida: string;
};

const PARAM_ORDER = ["q", "status", "responsavel", "origem", "pagina", "aba", "medida"] as const;

type ParamKey = (typeof PARAM_ORDER)[number];

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sentinela do filtro de responsável: `owner_id is null` não cabe numa querystring. */
export const NO_OWNER = "sem_responsavel";

export function parsePlanFilters(params: SearchParams): PlanFilters {
  const status = one(params.status);
  const responsavel = one(params.responsavel);
  const origem = one(params.origem);
  const aba = one(params.aba);
  const medida = one(params.medida);
  const pagina = Number.parseInt(one(params.pagina), 10);

  return {
    q: sanitizeQuery(one(params.q)),
    status: (STATUS_ORDER as readonly string[]).includes(status)
      ? (status as MeasureStatus)
      : "",
    responsavel: responsavel === NO_OWNER || UUID.test(responsavel) ? responsavel : "",
    origem: (RISK_SOURCE as readonly string[]).includes(origem) ? (origem as RiskSource) : "",
    pagina: Number.isFinite(pagina) && pagina > 1 ? pagina : 1,
    aba: TAB_KEYS.includes(aba) ? (aba as PlanTab) : "plano",
    medida: UUID.test(medida) ? medida : "",
  };
}

/**
 * `action_plans` não tem `search_tsv`: a busca vai por `ilike` em `code` e
 * `title`, montada como string no `.or()` do PostgREST. Vírgula, ponto e
 * parêntese são a gramática desse filtro — deixá-los passar seria injeção de
 * predicado. O saneamento é aqui, num lugar só.
 */
export function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function activeFilterCount(filters: PlanFilters): number {
  return [filters.q, filters.status, filters.responsavel, filters.origem].filter(Boolean).length;
}

/** Querystring canônica: trocar de aba, paginar ou abrir um plano preserva o resto. */
export function planQuery(
  filters: PlanFilters,
  overrides: Partial<Record<ParamKey, string | number | null>> = {},
): string {
  const values: Record<ParamKey, string> = {
    q: filters.q,
    status: filters.status,
    responsavel: filters.responsavel,
    origem: filters.origem,
    pagina: filters.pagina > 1 ? String(filters.pagina) : "",
    aba: filters.aba === "plano" ? "" : filters.aba,
    medida: filters.medida,
  };

  for (const [key, value] of Object.entries(overrides)) {
    values[key as ParamKey] = value === null || value === undefined ? "" : String(value);
  }

  const params = new URLSearchParams();
  for (const key of PARAM_ORDER) {
    if (values[key]) params.set(key, values[key]);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Trocar de aba nunca leva junto a medida em edição: o editor pertence à aba
 * Medidas, e reabri-lo noutra aba seria estado fantasma.
 */
export function planHref(id: string, filters: PlanFilters, tab?: PlanTab): string {
  return `${PLAN_PATH}/${id}${planQuery(filters, tab ? { aba: tab, medida: null } : { medida: null })}`;
}

/** Abre (ou fecha, com `null`) o editor de uma medida, preservando os filtros. */
export function measureHref(id: string, filters: PlanFilters, measureId: string | null): string {
  return `${PLAN_PATH}/${id}${planQuery(filters, { aba: "medidas", medida: measureId })}`;
}

/**
 * A origem do plano é UM campo na tela e DUAS colunas no banco (`report_id` e
 * `investigation_id`), governadas por uma terceira (`risk_source`). Escolher a
 * origem num `<select>` só, com o valor no formato `risk_source:uuid?`, torna
 * impossível gravar um plano que diz vir de uma denúncia e aponta para uma
 * investigação — ou que diz vir da CIPA e aponta para um relato.
 */
export function encodeOrigem(source: RiskSource, id: string | null): string {
  return `${source}:${id ?? ""}`;
}

export function decodeOrigem(
  raw: string,
): { source: RiskSource; reportId: string | null; investigationId: string | null } | null {
  const separator = raw.indexOf(":");
  if (separator < 0) return null;
  const source = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  if (!(RISK_SOURCE as readonly string[]).includes(source)) return null;
  if (id && !UUID.test(id)) return null;
  const typed = source as RiskSource;
  if (!id) return { source: typed, reportId: null, investigationId: null };
  if (typed === "denuncia") return { source: typed, reportId: id, investigationId: null };
  if (typed === "investigacao") return { source: typed, reportId: null, investigationId: id };
  // Só denúncia e investigação são módulos deste sistema; as demais origens
  // (inventário, auditoria, CIPA) não têm registro a que apontar.
  return null;
}

/** Situações em que a medida ainda consome trabalho de alguém. */
export function isOpenStatus(status: MeasureStatus): boolean {
  return status === "planejada" || status === "em_andamento" || status === "atrasada";
}

/**
 * A medida está esperando a etapa que todo mundo pula: foi concluída e ninguém
 * conferiu se funcionou.
 */
export function awaitsVerification(measure: {
  status: MeasureStatus;
  effectiveness: Effectiveness;
}): boolean {
  return measure.status === "concluida" && measure.effectiveness === "nao_verificada";
}

export type MeasureSummary = {
  status: MeasureStatus;
  effectiveness: Effectiveness;
};

/** Os quatro números do `.kpi-grid` do detalhe. O último é o que interessa à CIPA. */
export function summarize(measures: readonly MeasureSummary[]) {
  return {
    total: measures.length,
    concluidas: measures.filter(m => m.status === "concluida").length,
    atrasadas: measures.filter(m => m.status === "atrasada").length,
    eficazes: measures.filter(m => m.effectiveness === "eficaz").length,
    aguardandoVerificacao: measures.filter(awaitsVerification).length,
    ineficazes: measures.filter(m => needsFollowUp(m.effectiveness)).length,
  };
}
