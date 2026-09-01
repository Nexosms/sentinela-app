import type { Database } from "@/lib/supabase/database.types";
import { RELATIONSHIPS } from "@/lib/report/schema";

type Enums = Database["public"]["Enums"];

/**
 * Vocabulário compartilhado dos sete relatórios: identidade de cada um, o
 * recorte (período + unidade) que vive na querystring e os rótulos que a tela e
 * o CSV precisam falar igual.
 *
 * Módulo puro de propósito — nada de `server-only`, nada de Supabase. Quem
 * consulta é `relatorios-dados.ts`; quem exporta é a rota de CSV. Os dois
 * precisam do MESMO recorte, e um recorte que se calcula em dois lugares é um
 * recorte que diverge.
 */

export const REPORT_PATH = "/admin/relatorios";

/**
 * `report_exports.kind` tem CHECK e só aceita nove valores. Os sete relatórios
 * mapeiam nos seis que existem para eles; `prestacao-de-contas` cai em
 * `audit_trail` porque é exatamente isso que ele exporta — a trilha de quem
 * exportou o quê. Inventar `prestacao_de_contas` levaria 23514 na hora de
 * gravar a trilha, e sem trilha a exportação não sai.
 */
export const EXPORT_KIND = [
  "inbox_csv",
  "case_dossier",
  "cipa_indicators",
  "nr01_inventory",
  "audit_trail",
  "panorama",
  "sla",
  "desfechos",
  "retaliacao",
] as const;
export type ExportKind = (typeof EXPORT_KIND)[number];

export type ReportSlug =
  | "panorama"
  | "tempos-e-sla"
  | "desfechos"
  | "retaliacao"
  | "riscos-psicossociais"
  | "cipa"
  | "prestacao-de-contas";

export type ReportMeta = {
  slug: ReportSlug;
  title: string;
  eyebrow: string;
  /** A pergunta que o relatório responde — é o que o índice mostra. */
  question: string;
  exportKind: ExportKind;
  /** Nome-base do arquivo exportado. */
  file: string;
};

export const REPORTS: readonly ReportMeta[] = [
  {
    slug: "panorama",
    title: "Panorama do canal",
    eyebrow: "VOLUME E PERFIL",
    question:
      "Quanto o canal recebeu, de onde veio e quanta gente confiou nele a ponto de se identificar.",
    exportKind: "panorama",
    file: "panorama",
  },
  {
    slug: "tempos-e-sla",
    title: "Tempos e SLA",
    eyebrow: "PRAZOS ACORDADOS",
    question: "Quanto tempo o canal leva para triar e para concluir, contra o prazo da organização.",
    exportKind: "sla",
    file: "tempos-e-sla",
  },
  {
    slug: "desfechos",
    title: "Desfechos",
    eyebrow: "COMO OS CASOS TERMINAM",
    question: "Como os relatos foram encerrados, o que as apurações concluíram e o que virou medida.",
    exportKind: "desfechos",
    file: "desfechos",
  },
  {
    slug: "retaliacao",
    title: "Retaliação",
    eyebrow: "LEI 14.457/2022",
    question:
      "Se quem relata é protegido: tempo até a primeira ação, medidas protetivas e reincidência na mesma unidade.",
    exportKind: "retaliacao",
    file: "retaliacao",
  },
  {
    slug: "riscos-psicossociais",
    title: "Riscos psicossociais",
    eyebrow: "NR-01 · NR-17",
    question:
      "O inventário de fatores de organização do trabalho e quanto deles tem plano de ação ativo.",
    exportKind: "nr01_inventory",
    file: "riscos-psicossociais",
  },
  {
    slug: "cipa",
    title: "Relatório da CIPA",
    eyebrow: "DOCUMENTO ÚNICO",
    question: "O essencial dos anteriores num documento só, pronto para levar impresso à reunião.",
    exportKind: "cipa_indicators",
    file: "cipa",
  },
  {
    slug: "prestacao-de-contas",
    title: "Prestação de contas",
    eyebrow: "QUEM EXPORTOU O QUÊ",
    question: "Toda exportação feita neste painel: quem pediu, quando, com que filtro e quantas linhas.",
    exportKind: "audit_trail",
    file: "prestacao-de-contas",
  },
] as const;

const BY_SLUG = new Map(REPORTS.map(report => [report.slug, report]));

export function findReport(slug: string): ReportMeta | undefined {
  return BY_SLUG.get(slug as ReportSlug);
}

/* ── período ──────────────────────────────────────────────────────────────── */

/**
 * O período é medido em MESES fechados, não em dias.
 *
 * `v_report_metrics` e `v_category_distribution` já agregam por
 * `period_month`; recortar por dia obrigaria a reagrupar por fora da view (ou a
 * abandoná-la), e um relatório de "27/08 a 03/09" não é o documento que a CIPA
 * lê. `v_sla_performance` guarda `created_at`, e a função de banco converte o
 * mês em intervalo usando o fuso da organização.
 */
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-08" → "ago/2026". A data é fabricada em UTC: mês não tem fuso. */
export function formatMonth(key: string): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  return MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1))).replace(/\.| de /g, "");
}

/** Primeiro dia do mês, no formato de uma coluna `date`. */
export function monthStart(key: string): string {
  return `${key}-01`;
}

/** O mês corrente na operação — São Paulo, não o relógio do servidor. */
export function currentMonth(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
    .format(now)
    .slice(0, 7);
}

/** Soma meses sem sair do calendário (`Date.UTC` não conhece horário de verão). */
export function addMonths(key: string, months: number): string {
  const [year, month] = key.split("-").map(Number);
  if (!year || !month) return key;
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
  return shifted.toISOString().slice(0, 7);
}

/** Os últimos 12 meses fechados incluindo o corrente. É o padrão de todo relatório. */
export function defaultPeriod(now: Date = new Date()): { de: string; ate: string } {
  const ate = currentMonth(now);
  return { de: addMonths(ate, -11), ate };
}

/** Lista de meses selecionáveis: 36 meses até o corrente, do mais recente ao mais antigo. */
export function monthOptions(now: Date = new Date()): string[] {
  const ate = currentMonth(now);
  return Array.from({ length: 36 }, (_, index) => addMonths(ate, -index));
}

/* ── filtros ──────────────────────────────────────────────────────────────── */

export type SearchParams = Record<string, string | string[] | undefined>;

export type ReportFilters = {
  /** Mês inicial, `AAAA-MM`. */
  de: string;
  /** Mês final, `AAAA-MM`, inclusive. */
  ate: string;
  /** `org_units.id`, ou "" para a organização inteira. */
  unidade: string;
  /** `?print=1`: versão limpa para impressão. */
  print: boolean;
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseReportFilters(params: SearchParams, now: Date = new Date()): ReportFilters {
  const fallback = defaultPeriod(now);
  const de = one(params.de);
  const ate = one(params.ate);
  const unidade = one(params.unidade);

  const inicio = MONTH.test(de) ? de : fallback.de;
  const fim = MONTH.test(ate) ? ate : fallback.ate;

  return {
    // Período invertido é erro de digitação, não pedido: ordena em vez de
    // devolver um relatório vazio que parece "nenhum caso no período".
    de: inicio <= fim ? inicio : fim,
    ate: inicio <= fim ? fim : inicio,
    unidade: UUID.test(unidade) ? unidade : "",
    print: one(params.print) === "1",
  };
}

const PARAM_ORDER = ["de", "ate", "unidade", "print"] as const;
type ParamKey = (typeof PARAM_ORDER)[number];

/** Querystring canônica: imprimir ou exportar preserva exatamente o recorte da tela. */
export function reportQuery(
  filters: ReportFilters,
  overrides: Partial<Record<ParamKey, string | null>> = {},
): string {
  const values: Record<ParamKey, string> = {
    de: filters.de,
    ate: filters.ate,
    unidade: filters.unidade,
    print: filters.print ? "1" : "",
  };

  for (const [key, value] of Object.entries(overrides)) {
    values[key as ParamKey] = value ?? "";
  }

  const params = new URLSearchParams();
  for (const key of PARAM_ORDER) {
    if (values[key]) params.set(key, values[key]);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function reportHref(slug: ReportSlug, filters: ReportFilters): string {
  return `${REPORT_PATH}/${slug}${reportQuery(filters, { print: null })}`;
}

export function printHref(slug: ReportSlug, filters: ReportFilters): string {
  return `${REPORT_PATH}/${slug}${reportQuery(filters, { print: "1" })}`;
}

export function exportHref(slug: ReportSlug, filters: ReportFilters): string {
  return `/api/admin/relatorios/${slug}/export${reportQuery(filters, { print: null })}`;
}

/** "ago2026 a jul2026 · Filial" — o subtítulo do cabeçalho e do arquivo exportado. */
export function periodLabel(filters: ReportFilters): string {
  return filters.de === filters.ate
    ? formatMonth(filters.de)
    : `${formatMonth(filters.de)} a ${formatMonth(filters.ate)}`;
}

/* ── rótulos ──────────────────────────────────────────────────────────────── */

export const RELATIONSHIP_LABEL: Record<string, string> = {
  ...Object.fromEntries(RELATIONSHIPS.map(item => [item.value, item.label])),
  outro: "Outro vínculo",
  nao_informado: "Não informado",
};

export const INVESTIGATION_STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const OUTCOME_LABEL: Record<string, string> = {
  procedente: "Procedente",
  parcialmente_procedente: "Parcialmente procedente",
  improcedente: "Improcedente",
  inconclusiva: "Inconclusiva",
  sem_desfecho: "Sem desfecho registrado",
};

/**
 * O valor que aparece no lugar de uma célula suprimida. Existe como constante
 * porque a tela e a nota de rodapé precisam mostrar o MESMO símbolo, e porque
 * procurar por ele é a forma de conferir que nenhum número cru escapou.
 */
export const SUPPRESSED = "—";

export type Cell = number | null;

/**
 * Formata uma célula já suprimida no banco.
 *
 * O `null` que chega aqui NÃO é "ainda não carregou": é a resposta de
 * `public.suppress_small_cell()`, que devolve NULL quando a contagem fica
 * abaixo de `organizations.min_cell_size`. O número cru nunca esteve nesta
 * função — se estivesse, esconder aqui seria teatro.
 */
export function cell(value: Cell): string {
  return value === null || value === undefined ? SUPPRESSED : String(value);
}

/** Uma célula suprimida sai do CSV como campo vazio, não como "—" nem como 0. */
export function csvCell(value: Cell): string {
  return value === null || value === undefined ? "" : String(value);
}

export function isSuppressed(...values: Cell[]): boolean {
  return values.some(value => value === null || value === undefined);
}

/** Horas em algo que se lê: "18 h", "2,5 d". */
export function formatHours(value: number | null): string {
  if (value === null || value === undefined) return SUPPRESSED;
  if (value < 48) return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
  return `${(value / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} d`;
}

/** Percentual só existe quando numerador E denominador sobreviveram à supressão. */
export function percent(part: Cell, whole: Cell): string {
  if (part === null || whole === null || !whole) return SUPPRESSED;
  return `${Math.round((part / whole) * 100)}%`;
}

/** Largura do medidor `.kpi-grid article>i`. Célula suprimida não desenha barra. */
export function barWidth(part: Cell, whole: Cell): string {
  if (part === null || whole === null || !whole) return "0%";
  return `${Math.min(100, Math.round((part / whole) * 100))}%`;
}

export type RiskLevel = Enums["risk_level"];

/** A severidade do inventário chega como texto do banco; só as quatro valem. */
export function asRisk(value: string | null): RiskLevel | null {
  return value === "baixo" || value === "moderado" || value === "alto" || value === "critico"
    ? value
    : null;
}
