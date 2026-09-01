import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type AppRole = Enums["app_role"];
export type MemberStatus = Enums["member_status"];
export type CategoryGroup = Enums["category_group"];
export type RiskLevel = Enums["risk_level"];

export const SETTINGS_PATH = "/admin/configuracoes";

/**
 * As quatro áreas de Configurações são ABAS por `?aba=`, não sub-rotas.
 *
 * Por quê: as quatro compartilham exatamente o mesmo cabeçalho ("você está
 * configurando a organização X") e o mesmo `getStaffContext()`. Como
 * `layout.tsx` do App Router não recebe `searchParams`, um conjunto de
 * sub-rotas ou repetiria esse cabeçalho quatro vezes ou o esconderia num
 * layout que não sabe qual aba está aberta. Com `?aba=` a página inteira
 * continua um Server Component só, o link continua compartilhável, e o
 * vocabulário `.detail-tabs` — que já é o padrão de aba deste projeto em
 * denúncias, investigações e planos — vale sem nenhuma regra nova de CSS.
 */
export const TABS = [
  { key: "organizacao", label: "Organização" },
  { key: "unidades", label: "Unidades" },
  { key: "categorias", label: "Categorias" },
  { key: "equipe", label: "Equipe" },
] as const;

export type SettingsTab = (typeof TABS)[number]["key"];

const TAB_KEYS = TABS.map(tab => tab.key) as readonly string[];

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SearchParams = {
  aba?: string;
  unidade?: string;
  categoria?: string;
  membro?: string;
};

export type SettingsFilters = {
  aba: SettingsTab;
  /** Id da unidade em edição, ou "nova". */
  unidade: string;
  /** Id da categoria própria em edição, ou "nova". */
  categoria: string;
  /** Id do vínculo (`org_members.id`) em edição. */
  membro: string;
};

function one(value: string | undefined, allow: (v: string) => boolean): string {
  return value && allow(value) ? value : "";
}

export function parseSettingsFilters(params: SearchParams): SettingsFilters {
  const aba = TAB_KEYS.includes(params.aba ?? "") ? (params.aba as SettingsTab) : "organizacao";
  const editable = (v: string) => v === "nova" || UUID.test(v);
  return {
    aba,
    unidade: one(params.unidade, editable),
    categoria: one(params.categoria, editable),
    membro: one(params.membro, v => UUID.test(v)),
  };
}

/** Href preservando só o que faz sentido na aba de destino. */
export function settingsHref(
  aba: SettingsTab,
  extra?: { unidade?: string; categoria?: string; membro?: string },
): string {
  const query = new URLSearchParams();
  if (aba !== "organizacao") query.set("aba", aba);
  if (extra?.unidade) query.set("unidade", extra.unidade);
  if (extra?.categoria) query.set("categoria", extra.categoria);
  if (extra?.membro) query.set("membro", extra.membro);
  const suffix = query.toString();
  return suffix ? `${SETTINGS_PATH}?${suffix}` : SETTINGS_PATH;
}

// ── Papéis e situação ────────────────────────────────────────────────────────

export const ROLE_ORDER: readonly AppRole[] = ["admin", "triagem", "investigador", "comite"];

/** O que cada papel PODE fazer, em uma linha. O rótulo sozinho não decide nada. */
export const ROLE_DESCRIPTION: Record<AppRole, string> = {
  admin: "Configura a organização, convida e remove pessoas, vê tudo.",
  triagem: "Recebe e classifica denúncias, abre investigações e planos.",
  investigador: "Conduz investigações e executa medidas dos planos de ação.",
  comite: "Lê indicadores, relatórios e auditoria. Não movimenta casos.",
};

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  invited: "Convidado (ainda não entrou)",
  active: "Ativo",
  suspended: "Suspenso",
};

// ── Categorias ───────────────────────────────────────────────────────────────

export const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  violencia_conduta: "Grupo A · Violência e conduta",
  organizacao_trabalho: "Grupo B · Organização do trabalho",
};

export const CATEGORY_GROUP_ORDER: readonly CategoryGroup[] = [
  "violencia_conduta",
  "organizacao_trabalho",
];

export const RISK_LABEL: Record<RiskLevel, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
  critico: "Crítico",
};

export const RISK_ORDER: readonly RiskLevel[] = ["baixo", "moderado", "alto", "critico"];

/** `.risk.crítico` tem acento no design system; o enum do Postgres não. */
export function riskClass(risk: RiskLevel): string {
  return `risk ${risk === "critico" ? "crítico" : risk}`;
}

/** `categories_code_check`: `^[a-z0-9_]{3,60}$`. Gerado do rótulo, editável. */
export function slugifyCode(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// ── CNPJ ─────────────────────────────────────────────────────────────────────

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

/**
 * Dígitos verificadores do CNPJ (módulo 11, pesos 2..9 da direita para a
 * esquerda). Só o comprimento não serve: `00000000000000` tem 14 dígitos e
 * passaria pelo CHECK `^\d{14}$` do banco. Um CNPJ errado no cadastro sai
 * impresso no relatório que vai para a fiscalização.
 */
export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  // Todos iguais passam no módulo 11 e não existem na Receita.
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const check = (length: number): number => {
    let weight = 2;
    let sum = 0;
    for (let i = length - 1; i >= 0; i -= 1) {
      sum += Number(digits[i]) * weight;
      weight = weight === 9 ? 2 : weight + 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
}

/** Só para exibir. O banco guarda 14 dígitos limpos (`organizations_cnpj_check`). */
export function formatCnpj(digits: string | null): string {
  if (!digits || digits.length !== 14) return digits ?? "—";
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

// ── Fuso ─────────────────────────────────────────────────────────────────────

/**
 * Os fusos do Brasil. A lista é fechada de propósito: o fuso entra em cálculo
 * de prazo de SLA e em corte de mês de relatório, e um valor livre ("BRT")
 * quebraria o `Intl` sem avisar.
 */
export const TIMEZONES: readonly { value: string; label: string }[] = [
  { value: "America/Sao_Paulo", label: "Brasília (America/Sao_Paulo) · UTC−3" },
  { value: "America/Bahia", label: "Bahia (America/Bahia) · UTC−3" },
  { value: "America/Fortaleza", label: "Ceará (America/Fortaleza) · UTC−3" },
  { value: "America/Recife", label: "Pernambuco (America/Recife) · UTC−3" },
  { value: "America/Belem", label: "Pará (America/Belem) · UTC−3" },
  { value: "America/Araguaina", label: "Tocantins (America/Araguaina) · UTC−3" },
  { value: "America/Campo_Grande", label: "Mato Grosso do Sul (America/Campo_Grande) · UTC−4" },
  { value: "America/Cuiaba", label: "Mato Grosso (America/Cuiaba) · UTC−4" },
  { value: "America/Manaus", label: "Amazonas (America/Manaus) · UTC−4" },
  { value: "America/Porto_Velho", label: "Rondônia (America/Porto_Velho) · UTC−4" },
  { value: "America/Boa_Vista", label: "Roraima (America/Boa_Vista) · UTC−4" },
  { value: "America/Rio_Branco", label: "Acre (America/Rio_Branco) · UTC−5" },
  { value: "America/Noronha", label: "Fernando de Noronha (America/Noronha) · UTC−2" },
];

export const TIMEZONE_VALUES = TIMEZONES.map(zone => zone.value);

// ── Supressão de célula pequena ──────────────────────────────────────────────

/**
 * O piso do limiar de supressão. NÃO é preferência de estilo.
 *
 * `min_cell_size` é o número abaixo do qual `public.suppress_small_cell()`
 * troca a célula do relatório por "—". Com 2, uma unidade de dois funcionários
 * e um relato de assédio identifica o denunciante para o gestor que lê o
 * relatório: a célula "1" na linha daquela unidade É o nome da pessoa. Três é
 * o mínimo defensável, e cinco é o padrão do projeto.
 */
export const MIN_CELL_SIZE_FLOOR = 3;
export const MIN_CELL_SIZE_DEFAULT = 5;

/** UF é `character(2)` com CHECK `^[A-Z]{2}$`. */
export const UFS: readonly string[] = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];
