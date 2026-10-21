import { z } from "zod";

/**
 * O formato do relatório mensal guardado em `report_snapshots.metrics`.
 *
 * Módulo puro (sem `server-only`, sem Supabase): o motor que GERA e o painel
 * que MOSTRA precisam do mesmo contrato, e o painel também roda no navegador
 * (botão de imprimir).
 *
 * Duas regras de privacidade moram aqui, no formato, e não na tela:
 *
 * 1. O `total` do mês e a série mensal são sempre exatos (decisão da Nexo).
 * 2. Todo o resto é gravado JÁ protegido. Um número que não pode aparecer fica
 *    `null` (ou a quebra inteira fica `visivel: false`) ANTES de ir para o
 *    banco — o valor cru nunca chega ao navegador do cliente, então esconder
 *    no HTML não é a defesa.
 *
 * Por que a quebra é "tudo ou nada": com o total sempre visível, mostrar as
 * partes grandes de uma divisão e esconder só a pequena permitiria descobri-la
 * por subtração (total − partes visíveis). Se qualquer parte não-zero da
 * divisão fica abaixo do mínimo, a divisão inteira é omitida.
 */

export const MONTHLY_KIND = "mensal";
export const MONTHLY_VERSION = 1;

const celula = z.number().int().nullable();

const itemSchema = z.object({
  chave: z.string(),
  rotulo: z.string(),
  total: z.number().int(),
});

/** Uma divisão do total (risco, situação). `itens` fica vazio se `visivel` é falso. */
const divisaoSchema = z.object({
  visivel: z.boolean(),
  itens: z.array(itemSchema),
});

const indicadoresSchema = z.object({
  /** Sempre exato. */
  total: z.number().int(),
  anonimas: celula,
  urgentes: celula,
  altoRisco: celula,
  criticos: celula,
  abertos: celula,
  emTriagem: celula,
  encerrados: celula,
  porRisco: divisaoSchema,
  porSituacao: divisaoSchema,
});

const tempoSchema = z.object({
  /** Prazo contratado, em horas. */
  slaTriagemHoras: z.number(),
  slaApuracaoHoras: z.number(),
  /** % dos relatos do mês triados dentro do prazo. */
  triagemNoPrazoPct: z.number().int().nullable(),
  medianaTriagemH: z.number().nullable(),
  conclusaoNoPrazoPct: z.number().int().nullable(),
  medianaConclusaoH: z.number().nullable(),
});

export const monthlyMetricsSchema = z.object({
  versao: z.literal(MONTHLY_VERSION),
  /** `AAAA-MM`. */
  mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  geradoEm: z.string(),
  empresa: z.object({ nome: z.string(), cnpj: z.string().nullable() }),
  /** Limiar de proteção usado (organizations.min_cell_size). */
  minimo: z.number().int(),
  atual: indicadoresSchema,
  /** Mês anterior, com a mesma proteção — para as setas de variação. */
  anterior: indicadoresSchema,
  /** Últimos 12 meses (incluindo o do relatório). Totais exatos. */
  serie: z.array(z.object({ mes: z.string(), total: z.number().int() })),
  categorias: z.object({
    itens: z.array(z.object({ rotulo: z.string(), grupo: z.string(), total: z.number().int() })),
    /** Há categorias que ficaram de fora por serem poucas. Só um aviso, sem número. */
    ocultas: z.boolean(),
  }),
  tempos: tempoSchema,
});

export type MonthlyMetrics = z.infer<typeof monthlyMetricsSchema>;
export type Indicadores = z.infer<typeof indicadoresSchema>;
export type Divisao = z.infer<typeof divisaoSchema>;

/* ── meses ────────────────────────────────────────────────────────────────── */

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMes(value: string): boolean {
  return MES.test(value);
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "2026-09" → "Setembro de 2026". */
export function mesPorExtenso(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  if (!ano || !m) return mes;
  return `${MESES[m - 1]} de ${ano}`;
}

/** "2026-09" → "set/26" (rótulo curto do gráfico). */
export function mesCurto(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  if (!ano || !m) return mes;
  return `${MESES[m - 1].slice(0, 3).toLowerCase()}/${String(ano).slice(2)}`;
}

/** O mês anterior ao corrente em São Paulo — o que o cron gera no dia 1º. */
export function mesAnteriorAoAtual(now: Date = new Date()): string {
  const atual = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
    .format(now)
    .slice(0, 7);
  return somarMeses(atual, -1);
}

export function somarMeses(mes: string, meses: number): string {
  const [ano, m] = mes.split("-").map(Number);
  if (!ano || !m) return mes;
  return new Date(Date.UTC(ano, m - 1 + meses, 1)).toISOString().slice(0, 7);
}

/** Primeiro e último dia do mês, como colunas `date`. */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

export function formatCnpj(raw: string | null): string | null {
  if (!raw) return null;
  const d = raw.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return raw;
}
