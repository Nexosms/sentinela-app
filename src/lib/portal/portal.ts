import { sanitizeQuery } from "@/lib/admin/investigacoes";

/** Rótulos, abas e querystring do Portal do Cliente. Sem `server-only`: a UI cliente também importa. */

export const MEETINGS_PATH = "/admin/reunioes";
export const MATERIALS_PATH = "/admin/materiais";

/** Gestão da Nexo, por empresa. */
export function portalAdminPath(orgId: string): string {
  return `/admin/clientes/${orgId}/portal`;
}
export function portalAdminMeetingPath(orgId: string, meetingId: string): string {
  return `${portalAdminPath(orgId)}/reunioes/${meetingId}`;
}

// ── Reuniões ────────────────────────────────────────────────────────────────

export const MEETING_STATUS = ["agendada", "realizada", "cancelada"] as const;
export type MeetingStatus = (typeof MEETING_STATUS)[number];

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

/** O selo reusa `.risk`; o tom é semântico: o que ainda vai acontecer chama atenção, o resto esfria. */
export function meetingStatusClass(status: string): string {
  const tone: Record<string, string> = {
    agendada: "moderado",
    realizada: "baixo",
    cancelada: "arquivada",
  };
  return `risk ${tone[status] ?? "moderado"}`;
}

/** As colunas de status são `text` com CHECK (não enum), então chegam do banco como `string`. */
export function meetingStatusLabel(status: string): string {
  return (MEETING_STATUS_LABEL as Record<string, string>)[status] ?? status;
}

export const ACTION_STATUS = ["pendente", "em_andamento", "concluido"] as const;
export type ActionStatus = (typeof ACTION_STATUS)[number];

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
};

export function actionStatusClass(status: string): string {
  const tone: Record<string, string> = {
    pendente: "moderado",
    em_andamento: "alto",
    concluido: "baixo",
  };
  return `risk ${tone[status] ?? "moderado"}`;
}

export function actionStatusLabel(status: string): string {
  return (ACTION_STATUS_LABEL as Record<string, string>)[status] ?? status;
}

export type PortalFileKind = "recording" | "meeting_file" | "material";

/** `kind` também é `text` com CHECK; o valor vem do banco já validado. */
export function asFileKind(value: string): PortalFileKind {
  return value === "recording" || value === "material" ? value : "meeting_file";
}

export const MEETING_TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "acoes", label: "Ações" },
  { key: "gravacao", label: "Gravação" },
  { key: "arquivos", label: "Arquivos" },
] as const;
export type MeetingTab = (typeof MEETING_TABS)[number]["key"];

const MEETING_TAB_KEYS = MEETING_TABS.map(tab => tab.key) as readonly string[];

export function parseMeetingTab(raw: string | string[] | undefined): MeetingTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && MEETING_TAB_KEYS.includes(value) ? (value as MeetingTab) : "resumo";
}

export function meetingTabHref(basePath: string, tab: MeetingTab): string {
  return tab === "resumo" ? basePath : `${basePath}?aba=${tab}`;
}

// ── Materiais ───────────────────────────────────────────────────────────────

export const MATERIAL_CATEGORIES = [
  {
    key: "treinamento",
    label: "Materiais de Treinamento",
    short: "Treinamento",
    description:
      "Apresentações usadas nos treinamentos, apostilas e materiais complementares, vídeos e gravações, documentos e orientações técnicas.",
  },
  {
    key: "cdn_conecta",
    label: "CDN Conecta",
    short: "CDN Conecta",
    description:
      "Materiais informativos, comunicados e conteúdos educativos do CDN Conecta, com apresentações, vídeos e documentos do programa.",
  },
  {
    key: "cartazes",
    label: "Cartazes de Divulgação",
    short: "Cartazes",
    description:
      "Cartazes institucionais do CDN, materiais com QR Code para acesso ao canal, peças de divulgação e campanhas — prontos para imprimir ou compartilhar.",
  },
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number]["key"];

const CATEGORY_KEYS = MATERIAL_CATEGORIES.map(category => category.key) as readonly string[];

export function categoryLabel(key: string): string {
  return MATERIAL_CATEGORIES.find(category => category.key === key)?.label ?? key;
}

export type MaterialFilters = { categoria: MaterialCategory | ""; q: string };

export function parseMaterialFilters(params: Record<string, string | string[] | undefined>): MaterialFilters {
  const pick = (value: string | string[] | undefined) =>
    ((Array.isArray(value) ? value[0] : value) ?? "").trim();
  const categoria = pick(params.categoria);
  return {
    categoria: CATEGORY_KEYS.includes(categoria) ? (categoria as MaterialCategory) : "",
    // `q` entra num `.or()` do PostgREST: vírgula, ponto e parêntese são a gramática dele.
    q: sanitizeQuery(pick(params.q)),
  };
}

export function materialsHref(basePath: string, filters: MaterialFilters, override: Partial<MaterialFilters> = {}): string {
  const merged = { ...filters, ...override };
  const search = new URLSearchParams();
  if (merged.categoria) search.set("categoria", merged.categoria);
  if (merged.q) search.set("q", merged.q);
  const query = search.toString();
  return query ? `${basePath}?${query}` : basePath;
}

// ── Campos de formulário ────────────────────────────────────────────────────

/** `participants` é `text[]`; no formulário é um texto com um nome por linha ou separados por vírgula. */
export function parseParticipants(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map(name => name.trim())
    .filter(Boolean)
    .slice(0, 50);
}

/** `timestamptz` → valor de `<input type="datetime-local">` no horário de São Paulo. */
export function toDatetimeLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** `datetime-local` não traz fuso; o Brasil não tem horário de verão desde 2019 (mesmo critério de investigacoes). */
export function fromDatetimeLocal(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
