import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type ReportStatus = Enums["report_status"];
export type RiskLevel = Enums["risk_level"];
export type ReportMode = Enums["report_mode"];

export const STATUS_LABEL: Record<ReportStatus, string> = {
  em_triagem: "Em triagem",
  em_apuracao: "Em apuração",
  aguardando_informacao: "Aguardando informação",
  concluida: "Concluída",
  arquivada: "Arquivada",
};

export const STATUS_ORDER: readonly ReportStatus[] = [
  "em_triagem",
  "em_apuracao",
  "aguardando_informacao",
  "concluida",
  "arquivada",
];

/** Status que ainda consomem trabalho da equipe. */
export const OPEN_STATUSES: readonly ReportStatus[] = [
  "em_triagem",
  "em_apuracao",
  "aguardando_informacao",
];

export const RISK_LABEL: Record<RiskLevel, string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
  critico: "Crítico",
};

export const RISK_ORDER: readonly RiskLevel[] = ["critico", "alto", "moderado", "baixo"];

/**
 * O design system foi escrito em português com acento (`.risk.crítico`), enquanto o enum do
 * Postgres é `critico`. Interpolar o valor do banco direto no `className` deixa o selo crítico
 * — justamente o mais importante — sem cor nenhuma. Todo `className="risk …"` passa por aqui.
 */
export function riskClass(risk: RiskLevel): string {
  return `risk ${risk === "critico" ? "crítico" : risk}`;
}

export const MODE_LABEL: Record<ReportMode, string> = {
  anonymous: "Anônima",
  identified: "Identificada",
};

const DATE = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}

/**
 * Coluna `date` (sem hora) formatada como TEXTO, nunca por `Date`.
 *
 * `formatDate()` acima está certo para `timestamptz` e não deve mudar. Para uma
 * `date` ele quebra: `new Date("2026-08-28")` é meia-noite **UTC**, que em São
 * Paulo ainda é 27/08 às 21h — o prazo apareceria um dia antes do que foi
 * digitado. Data sem hora não tem fuso, então não passa por fuso nenhum.
 *
 * Vale para `investigations.planned_start/planned_end`,
 * `action_plans.starts_on/due_on` e `action_measures.due_on/verify_on`.
 * Nasceu em `lib/admin/investigacoes.ts` (Fase 5, Agente F) e subiu para cá
 * quando o segundo módulo passou a precisar dela.
 */
export function formatDateOnly(value: string): string {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

/**
 * Comparação de `date` como texto ISO: `AAAA-MM-DD` ordena lexicograficamente
 * igual ao calendário, e assim a comparação não precisa de fuso nenhum. O
 * "hoje" tem que vir de `todayInSaoPaulo()`, não do relógio do servidor.
 */
export function isPastDue(dateOnly: string | null, today: string): boolean {
  return Boolean(dateOnly && dateOnly < today);
}

/** O "hoje" da operação. `en-CA` devolve `AAAA-MM-DD`, o mesmo formato de uma `date`. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/**
 * Soma dias a uma `date` sem sair do calendário. `Date.UTC` mantém a conta em
 * UTC do início ao fim — se o servidor estivesse num fuso com horário de verão,
 * um `new Date(a, m, d)` local poderia devolver o dia anterior.
 */
export function addDaysOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return dateOnly;
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** "há 3 dias" — o protótipo mostrava a idade do caso, não o carimbo absoluto. */
export function relativeAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} dia${days > 1 ? "s" : ""}`;
  const months = Math.round(days / 30);
  return `há ${months} ${months > 1 ? "meses" : "mês"}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
