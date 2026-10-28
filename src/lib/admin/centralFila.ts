/**
 * Regras da "Fila do dia" da Central — puras, sem acesso a dados, para serem testáveis.
 *
 * A fila junta, entre as empresas que a pessoa pode ver, os relatos em aberto que pedem olhar hoje:
 * críticos, com prazo vencido, sem responsável ou ainda em triagem. Quem pode ver o quê continua
 * sendo decidido pela RLS e pela grade de permissões; nada aqui amplia acesso.
 */

import type { ReportStatus, RiskLevel } from "@/lib/admin/labels";

export type FilaItem = {
  id: string;
  orgId: string;
  orgName: string;
  protocol: string;
  status: ReportStatus;
  risk: RiskLevel;
  dueAt: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  createdAt: string;
};

export type FilaFiltro = "todos" | "criticos" | "vencidos" | "sem-responsavel" | "triagem";

export const FILA_FILTROS: readonly { key: FilaFiltro; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "criticos", label: "Críticos" },
  { key: "vencidos", label: "Prazo vencido" },
  { key: "sem-responsavel", label: "Sem responsável" },
  { key: "triagem", label: "Em triagem" },
];

const RISK_RANK: Record<RiskLevel, number> = { critico: 0, alto: 1, moderado: 2, baixo: 3 };

/** Dia civil em São Paulo ("2026-10-28"): prazo e "hoje" se comparam por dia, não por instante. */
function diaSP(data: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(data);
}

function diasEntre(deDia: string, ateDia: string): number {
  const a = Date.parse(`${deDia}T00:00:00Z`);
  const b = Date.parse(`${ateDia}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function estaVencido(item: Pick<FilaItem, "dueAt">, agora: Date): boolean {
  return item.dueAt !== null && new Date(item.dueAt).getTime() < agora.getTime();
}

const CASAMENTO: Record<Exclude<FilaFiltro, "todos">, (item: FilaItem, agora: Date) => boolean> = {
  criticos: item => item.risk === "critico",
  vencidos: (item, agora) => estaVencido(item, agora),
  "sem-responsavel": item => item.assignedTo === null,
  triagem: item => item.status === "em_triagem",
};

/** Um relato entra na fila se bater em QUALQUER um dos quatro motivos. */
export function entraNaFila(item: FilaItem, agora: Date): boolean {
  return (Object.keys(CASAMENTO) as (keyof typeof CASAMENTO)[]).some(chave =>
    CASAMENTO[chave](item, agora),
  );
}

export function casaComFiltro(item: FilaItem, filtro: FilaFiltro, agora: Date): boolean {
  return filtro === "todos" ? true : CASAMENTO[filtro](item, agora);
}

/** Mais grave primeiro; no mesmo risco, o prazo mais antigo; sem prazo por último; depois o mais novo. */
export function ordenarFila(itens: FilaItem[]): FilaItem[] {
  return [...itens].sort((a, b) => {
    const risco = RISK_RANK[a.risk] - RISK_RANK[b.risk];
    if (risco !== 0) return risco;
    if (a.dueAt && b.dueAt) {
      const prazo = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (prazo !== 0) return prazo;
    } else if (a.dueAt) {
      return -1;
    } else if (b.dueAt) {
      return 1;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function contarPorFiltro(itens: FilaItem[], agora: Date): Record<FilaFiltro, number> {
  const contagem: Record<FilaFiltro, number> = {
    todos: itens.length,
    criticos: 0,
    vencidos: 0,
    "sem-responsavel": 0,
    triagem: 0,
  };
  for (const item of itens) {
    for (const chave of Object.keys(CASAMENTO) as (keyof typeof CASAMENTO)[]) {
      if (CASAMENTO[chave](item, agora)) contagem[chave] += 1;
    }
  }
  return contagem;
}

export type PrazoInfo = {
  tom: "vencido" | "hoje" | "amanha" | "futuro" | "sem";
  rotulo: string;
};

export function prazoInfo(dueAt: string | null, agora: Date): PrazoInfo {
  if (!dueAt) return { tom: "sem", rotulo: "Sem prazo" };
  const prazo = new Date(dueAt);
  const dias = diasEntre(diaSP(agora), diaSP(prazo));
  if (prazo.getTime() < agora.getTime()) {
    if (dias >= 0) return { tom: "vencido", rotulo: "Venceu hoje" };
    const atraso = -dias;
    return { tom: "vencido", rotulo: `Vencido há ${atraso} ${atraso === 1 ? "dia" : "dias"}` };
  }
  if (dias === 0) return { tom: "hoje", rotulo: "Vence hoje" };
  if (dias === 1) return { tom: "amanha", rotulo: "Vence amanhã" };
  return { tom: "futuro", rotulo: `Vence em ${dias} dias` };
}

/** "Grupo Alfa Ltda" → "GA". Sigla do cartão da empresa. */
export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .map(parte => parte[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** "há 12 min", "há 3 h", "ontem", "há 2 dias" — para a última atividade de cada empresa. */
export function haQuanto(iso: string, agora: Date): string {
  const minutos = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = diasEntre(diaSP(new Date(iso)), diaSP(agora));
  if (dias <= 1) return "ontem";
  return `há ${dias} dias`;
}
