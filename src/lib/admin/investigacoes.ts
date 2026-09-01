import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];

export type InvestigationStatus = Enums["investigation_status"];
export type InvestigationOutcome = Enums["investigation_outcome"];
export type InterviewKind = Enums["interview_kind"];

/** `role_in_case` e `confidence` são `text` com CHECK, não enum — a lista vem do CHECK. */
export const ROLE_IN_CASE = ["lead", "investigador", "observador", "juridico", "rh"] as const;
export type RoleInCase = (typeof ROLE_IN_CASE)[number];

export const CONFIDENCE = ["baixa", "media", "alta"] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export const INVESTIGATION_PATH = "/admin/investigacoes";

/** Mesma escala da caixa de entrada: um dia de trabalho cabe numa página. */
export const PAGE_SIZE = 25;

export const INV_STATUS_LABEL: Record<InvestigationStatus, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const INV_STATUS_ORDER = [
  "planejada",
  "em_andamento",
  "concluida",
  "cancelada",
] as const satisfies readonly InvestigationStatus[];

/** Status que o líder pode escolher à mão. `concluida` só sai da dupla assinatura. */
export const EDITABLE_STATUS = [
  "planejada",
  "em_andamento",
  "cancelada",
] as const satisfies readonly InvestigationStatus[];

export const OUTCOME_LABEL: Record<InvestigationOutcome, string> = {
  procedente: "Procedente",
  parcialmente_procedente: "Parcialmente procedente",
  improcedente: "Improcedente",
  inconclusiva: "Inconclusiva",
};

export const OUTCOME_ORDER = [
  "procedente",
  "parcialmente_procedente",
  "improcedente",
  "inconclusiva",
] as const satisfies readonly InvestigationOutcome[];

export const ROLE_IN_CASE_LABEL: Record<RoleInCase, string> = {
  lead: "Conduz a apuração",
  investigador: "Investigador",
  observador: "Observador",
  juridico: "Jurídico",
  rh: "Recursos humanos",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  baixa: "Confiança baixa",
  media: "Confiança média",
  alta: "Confiança alta",
};

export const INTERVIEW_KIND_LABEL: Record<InterviewKind, string> = {
  denunciante: "Quem relatou",
  denunciado: "Pessoa apontada",
  testemunha: "Testemunha",
  especialista: "Especialista",
  outro: "Outro",
};

export const INTERVIEW_KIND_ORDER = [
  "denunciante",
  "denunciado",
  "testemunha",
  "especialista",
  "outro",
] as const satisfies readonly InterviewKind[];

/**
 * O selo de status reusa `.risk`, que só tem quatro variantes de cor. O
 * mapeamento é semântico, não decorativo: cancelada e concluída saem do fluxo
 * (frio), em andamento é o que consome atenção agora.
 */
export function investigationStatusClass(status: InvestigationStatus): string {
  const tone: Record<InvestigationStatus, string> = {
    planejada: "moderado",
    em_andamento: "alto",
    concluida: "baixo",
    cancelada: "baixo",
  };
  return `risk ${tone[status]}`;
}

export const TABS = [
  { key: "plano", label: "Plano" },
  { key: "equipe", label: "Equipe" },
  { key: "denuncias", label: "Denúncias" },
  { key: "entrevistas", label: "Entrevistas" },
  { key: "achados", label: "Achados" },
] as const;

export type InvestigationTab = (typeof TABS)[number]["key"];

const TAB_KEYS = TABS.map(tab => tab.key) as readonly string[];

/** Em Next 16 `searchParams` chega como Promise; o tipo é o do valor resolvido. */
export type SearchParams = Record<string, string | string[] | undefined>;

export type InvestigationFilters = {
  q: string;
  status: InvestigationStatus | "";
  responsavel: string;
  pagina: number;
  aba: InvestigationTab;
};

const PARAM_ORDER = ["q", "status", "responsavel", "pagina", "aba"] as const;

type ParamKey = (typeof PARAM_ORDER)[number];

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Sentinela do filtro de responsável: `lead_id is null` não cabe numa querystring. */
export const NO_LEAD = "sem_responsavel";

export function parseInvestigationFilters(params: SearchParams): InvestigationFilters {
  const status = one(params.status);
  const responsavel = one(params.responsavel);
  const aba = one(params.aba);
  const pagina = Number.parseInt(one(params.pagina), 10);

  return {
    q: sanitizeQuery(one(params.q)),
    status: (INV_STATUS_ORDER as readonly string[]).includes(status)
      ? (status as InvestigationStatus)
      : "",
    responsavel: responsavel === NO_LEAD || UUID.test(responsavel) ? responsavel : "",
    pagina: Number.isFinite(pagina) && pagina > 1 ? pagina : 1,
    aba: TAB_KEYS.includes(aba) ? (aba as InvestigationTab) : "plano",
  };
}

/**
 * `investigations` não tem `search_tsv`: a busca vai por `ilike` em `code` e
 * `scope`, montada como string no `.or()` do PostgREST. Vírgula, ponto e
 * parêntese são a gramática desse filtro — deixá-los passar seria injeção de
 * predicado. O saneamento é aqui, num lugar só, e não em cada chamada.
 */
export function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function activeFilterCount(filters: InvestigationFilters): number {
  return [filters.q, filters.status, filters.responsavel].filter(Boolean).length;
}

/** Querystring canônica: trocar de aba, paginar ou abrir uma investigação preserva o resto. */
export function investigationQuery(
  filters: InvestigationFilters,
  overrides: Partial<Record<ParamKey, string | number | null>> = {},
): string {
  const values: Record<ParamKey, string> = {
    q: filters.q,
    status: filters.status,
    responsavel: filters.responsavel,
    pagina: filters.pagina > 1 ? String(filters.pagina) : "",
    aba: filters.aba === "plano" ? "" : filters.aba,
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

export function investigationHref(
  id: string,
  filters: InvestigationFilters,
  tab?: InvestigationTab,
): string {
  return `${INVESTIGATION_PATH}/${id}${investigationQuery(filters, tab ? { aba: tab } : {})}`;
}

/**
 * `formatDateOnly` e `isPastDue` nasceram aqui, para `planned_start`/
 * `planned_end`, mas não são de investigação: `action_plans.starts_on/due_on` e
 * `action_measures.due_on/verify_on` são igualmente `date` e caem na mesma
 * armadilha de fuso. Subiram para `labels.ts`, onde já moram `formatDate` e
 * `formatDateTime`, e continuam sendo reexportadas daqui para que os
 * importadores deste módulo não mudem.
 */
export { formatDateOnly, isPastDue } from "@/lib/admin/labels";

/**
 * "Pronta para revisão" não é coluna: é o estado em que o líder já escreveu
 * achados, recomendação e desfecho e ainda ninguém assinou. É o sinal que a
 * dupla assinatura da Lei 14.457 precisa para existir sem uma flag no banco.
 */
export function isReadyForReview(inv: {
  findings: string | null;
  recommendation: string | null;
  outcome: InvestigationOutcome | null;
  reviewed_at: string | null;
}): boolean {
  return Boolean(
    inv.reviewed_at === null &&
      inv.findings?.trim() &&
      inv.recommendation?.trim() &&
      inv.outcome,
  );
}
