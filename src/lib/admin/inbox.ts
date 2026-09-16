import type { ReportStatus, RiskLevel } from "./labels";
import { STATUS_ORDER, RISK_ORDER } from "./labels";

/** 25 casos por página: o suficiente para a triagem de um dia sem rolagem infinita. */
export const PAGE_SIZE = 25;

export const INBOX_PATH = "/admin/denuncias";

/** Valor sentinela do filtro de responsável — `assigned_to is null` não cabe numa querystring. */
export const UNASSIGNED = "nao_atribuido";

export const TABS = [
  { key: "visao-geral", label: "Visão geral" },
  { key: "linha-do-tempo", label: "Linha do tempo" },
  { key: "evidencias", label: "Evidências" },
  { key: "mensagens", label: "Mensagens" },
] as const;

export type InboxTab = (typeof TABS)[number]["key"];

const TAB_KEYS = TABS.map(tab => tab.key) as readonly string[];

/**
 * Abas da LISTA (não confundir com `TABS`/`aba` acima, que são as abas do
 * DETALHE de um caso). Nome de parâmetro diferente (`caixa`) de propósito,
 * para não colidir com `aba` na mesma querystring.
 */
export const INBOX_BOXES = [
  { key: "ativas", label: "Ativas" },
  { key: "arquivadas", label: "Arquivadas" },
] as const;

export type InboxBox = (typeof INBOX_BOXES)[number]["key"];

const BOX_KEYS = INBOX_BOXES.map(box => box.key) as readonly string[];

/** Em Next 16 `searchParams` chega como Promise; o tipo é o do valor já resolvido. */
export type SearchParams = Record<string, string | string[] | undefined>;

export type InboxFilters = {
  q: string;
  status: ReportStatus | "";
  risk: RiskLevel | "";
  unidade: string;
  responsavel: string;
  pagina: number;
  aba: InboxTab;
  caixa: InboxBox;
};

const PARAM_ORDER = [
  "q",
  "status",
  "risk",
  "unidade",
  "responsavel",
  "pagina",
  "aba",
  "caixa",
] as const;

type ParamKey = (typeof PARAM_ORDER)[number];

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseFilters(params: SearchParams): InboxFilters {
  const status = one(params.status);
  const risk = one(params.risk);
  const unidade = one(params.unidade);
  const responsavel = one(params.responsavel);
  const aba = one(params.aba);
  const caixa = one(params.caixa);
  const pagina = Number.parseInt(one(params.pagina), 10);

  return {
    // Limite defensivo: o índice GIN não ganha nada com um romance colado na busca.
    q: one(params.q).slice(0, 120),
    status: (STATUS_ORDER as readonly string[]).includes(status) ? (status as ReportStatus) : "",
    risk: (RISK_ORDER as readonly string[]).includes(risk) ? (risk as RiskLevel) : "",
    unidade: UUID.test(unidade) ? unidade : "",
    responsavel: responsavel === UNASSIGNED || UUID.test(responsavel) ? responsavel : "",
    pagina: Number.isFinite(pagina) && pagina > 1 ? pagina : 1,
    aba: TAB_KEYS.includes(aba) ? (aba as InboxTab) : "visao-geral",
    caixa: BOX_KEYS.includes(caixa) ? (caixa as InboxBox) : "ativas",
  };
}

/** Quantos filtros o usuário realmente ligou — o `<b>` do botão "Filtros" não é decorativo. */
export function activeFilterCount(filters: InboxFilters): number {
  return [filters.q, filters.status, filters.risk, filters.unidade, filters.responsavel].filter(
    Boolean,
  ).length;
}

/**
 * Querystring canônica. Trocar de aba, paginar ou abrir um caso preserva tudo
 * o mais que estiver ligado — a URL é o único estado desta tela.
 */
export function inboxQuery(
  filters: InboxFilters,
  overrides: Partial<Record<ParamKey, string | number | null>> = {},
): string {
  const values: Record<ParamKey, string> = {
    q: filters.q,
    status: filters.status,
    risk: filters.risk,
    unidade: filters.unidade,
    responsavel: filters.responsavel,
    pagina: filters.pagina > 1 ? String(filters.pagina) : "",
    aba: filters.aba === "visao-geral" ? "" : filters.aba,
    caixa: filters.caixa === "ativas" ? "" : filters.caixa,
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

export function caseHref(id: string, filters: InboxFilters, tab?: InboxTab): string {
  return `${INBOX_PATH}/${id}${inboxQuery(filters, tab ? { aba: tab } : {})}`;
}

/** Troca de caixa (Ativas/Arquivadas) sempre volta para a primeira página. */
export function inboxBoxHref(filters: InboxFilters, box: InboxBox): string {
  return `${INBOX_PATH}${inboxQuery(filters, { caixa: box === "ativas" ? null : box, pagina: null })}`;
}

/**
 * "A3F9-K2M4-XY71" é protocolo; "assédio moral" é texto. A busca full-text não
 * indexa o protocolo (o `search_tsv` cobre só relato, envolvidos, testemunhas e
 * local), então o protocolo precisa de um caminho próprio.
 */
export function looksLikeProtocol(q: string): boolean {
  return /^[A-Z0-9]+(-[A-Z0-9]+)+$/.test(q.trim());
}
