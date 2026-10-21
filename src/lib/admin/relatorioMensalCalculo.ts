import { OPEN_STATUSES, RISK_LABEL, RISK_ORDER, STATUS_LABEL, STATUS_ORDER } from "@/lib/admin/labels";
import type { Divisao, Indicadores, MonthlyMetrics } from "@/lib/admin/relatorioMensalTipos";

/**
 * A parte PURA do relatório mensal: recebe contagens exatas e devolve o que
 * pode ser gravado. Sem banco, sem relógio — por isso dá para testar cada regra
 * de proteção com números na mão.
 *
 * A regra única: uma contagem só sai daqui se ela e o seu complemento (o que
 * sobra do total) forem zero ou atingirem o mínimo. O complemento entra porque o
 * total do mês é sempre público — mostrar "9 de 10" entrega o "1" por subtração.
 */

export type LinhaMetrica = {
  period_month: string;
  status: string;
  risk: string;
  total: number;
  anonimos: number;
  urgentes: number;
  alto_risco: number;
};

export type LinhaCategoria = {
  period_month: string;
  label_pt: string;
  group_key: string;
  total: number;
};

const ABERTOS = new Set<string>(OPEN_STATUSES);
const ENCERRADOS = new Set(["concluida", "arquivada"]);

function permitido(valor: number, minimo: number): boolean {
  return valor === 0 || valor >= minimo;
}

/** Subconjunto do total: some se ele ou o resto ficarem pequenos (e não-zero). */
export function subconjunto(parte: number, total: number, minimo: number): number | null {
  // Zero e "todos" não dizem nada além do que o total (público) já diz.
  if (parte === 0 || parte === total) return parte;
  return permitido(parte, minimo) && permitido(total - parte, minimo) ? parte : null;
}

/** Divisão do total em partes: ou todas as partes não-zero passam, ou nenhuma aparece. */
export function dividir(
  partes: { chave: string; rotulo: string; total: number }[],
  minimo: number,
): Divisao {
  const comDado = partes.filter(parte => parte.total > 0);
  if (!comDado.every(parte => parte.total >= minimo)) return { visivel: false, itens: [] };
  return { visivel: true, itens: comDado };
}

function soma<T>(linhas: T[], campo: (linha: T) => number, filtro?: (linha: T) => boolean): number {
  let acc = 0;
  for (const linha of linhas) if (!filtro || filtro(linha)) acc += campo(linha);
  return acc;
}

/** Indicadores de UM mês. `linhas` já vem restrito ao mês. */
export function calcularIndicadores(linhas: LinhaMetrica[], minimo: number): Indicadores {
  const total = soma(linhas, l => l.total);
  const por = (filtro: (l: LinhaMetrica) => boolean) => soma(linhas, l => l.total, filtro);

  return {
    total,
    anonimas: subconjunto(soma(linhas, l => l.anonimos), total, minimo),
    urgentes: subconjunto(soma(linhas, l => l.urgentes), total, minimo),
    altoRisco: subconjunto(soma(linhas, l => l.alto_risco), total, minimo),
    criticos: subconjunto(por(l => l.risk === "critico"), total, minimo),
    abertos: subconjunto(por(l => ABERTOS.has(l.status)), total, minimo),
    emTriagem: subconjunto(por(l => l.status === "em_triagem"), total, minimo),
    encerrados: subconjunto(por(l => ENCERRADOS.has(l.status)), total, minimo),
    porRisco: dividir(
      RISK_ORDER.map(risco => ({
        chave: risco,
        rotulo: RISK_LABEL[risco],
        total: por(l => l.risk === risco),
      })),
      minimo,
    ),
    porSituacao: dividir(
      STATUS_ORDER.map(status => ({
        chave: status,
        rotulo: STATUS_LABEL[status],
        total: por(l => l.status === status),
      })),
      minimo,
    ),
  };
}

/** Série de `meses` (ordem cronológica) com zero nos meses sem relato. Totais exatos. */
export function calcularSerie(
  linhas: LinhaMetrica[],
  meses: string[],
): MonthlyMetrics["serie"] {
  const porMes = new Map<string, number>();
  for (const linha of linhas) {
    const mes = linha.period_month.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + linha.total);
  }
  return meses.map(mes => ({ mes, total: porMes.get(mes) ?? 0 }));
}

/**
 * Categoria é multirrótulo (um relato pode ter várias), então não forma uma
 * divisão do total: cada categoria é protegida sozinha. As pequenas somem e só
 * o aviso `ocultas` fica — sem número, para não virar pista.
 */
export function calcularCategorias(
  linhas: LinhaCategoria[],
  minimo: number,
): MonthlyMetrics["categorias"] {
  const acc = new Map<string, { rotulo: string; grupo: string; total: number }>();
  for (const linha of linhas) {
    const atual = acc.get(linha.label_pt) ?? { rotulo: linha.label_pt, grupo: linha.group_key, total: 0 };
    atual.total += linha.total;
    acc.set(linha.label_pt, atual);
  }
  const todas = [...acc.values()].filter(item => item.total > 0);
  const itens = todas.filter(item => item.total >= minimo).sort((a, b) => b.total - a.total);
  return { itens, ocultas: itens.length < todas.length };
}

export type LinhaSla = {
  sla_triagem_horas: number;
  sla_apuracao_horas: number;
  geral: {
    triados: number | null;
    encerrados: number | null;
    triagem_no_prazo: number | null;
    conclusao_no_prazo: number | null;
    mediana_triagem_h: number | null;
    mediana_conclusao_h: number | null;
  };
};

function pct(parte: number | null, todo: number | null): number | null {
  if (parte === null || todo === null || todo <= 0) return null;
  return Math.round((parte / todo) * 100);
}

/** `rel_sla` já devolve cada célula suprimida (null); aqui só se derivam percentuais. */
export function calcularTempos(sla: LinhaSla): MonthlyMetrics["tempos"] {
  return {
    slaTriagemHoras: sla.sla_triagem_horas,
    slaApuracaoHoras: sla.sla_apuracao_horas,
    triagemNoPrazoPct: pct(sla.geral.triagem_no_prazo, sla.geral.triados),
    medianaTriagemH: sla.geral.mediana_triagem_h,
    conclusaoNoPrazoPct: pct(sla.geral.conclusao_no_prazo, sla.geral.encerrados),
    medianaConclusaoH: sla.geral.mediana_conclusao_h,
  };
}
