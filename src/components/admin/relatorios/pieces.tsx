import type { ReactNode } from "react";

import { RISK_LABEL, riskClass } from "@/lib/admin/labels";
import {
  SUPPRESSED,
  asRisk,
  barWidth,
  cell,
  type Cell,
} from "@/lib/admin/relatorios";

/**
 * As peças visuais dos sete relatórios. Todas usam SÓ o vocabulário que já
 * existe em `globals.css` (`.kpi-grid`, `.chart-card`, `.panel-title`,
 * `.bar-chart`, `.category-row`, `.risk`, `.privacy-note`) mais a tabela e o
 * índice acrescentados no bloco `Fase 6`.
 *
 * Nenhuma delas sabe suprimir nada: elas recebem `number | null`, onde `null`
 * já é a resposta de `public.suppress_small_cell()` no SQL. `cell()` só escolhe
 * o símbolo. Se um dia uma peça precisar decidir se esconde um número, a
 * consulta é que está errada.
 */

/** Cartão de indicador. `<i>` é o medidor da base do cartão. */
export function Kpi({
  label,
  value,
  hint,
  part,
  whole,
  attention,
}: {
  label: string;
  value: string;
  hint: string;
  /** Numerador e denominador do medidor. Célula suprimida não desenha barra. */
  part?: Cell;
  whole?: Cell;
  attention?: boolean;
}) {
  const vazio = value === SUPPRESSED;
  const classes = [attention && !vazio ? "attention" : "", vazio ? "void" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes || undefined}>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{hint}</span>
      <i style={{ width: barWidth(part ?? null, whole ?? null) }} />
    </article>
  );
}

/** Painel branco com título. Espelha o `.chart-card` do dashboard. */
export function Panel({
  kicker,
  title,
  aside,
  children,
}: {
  kicker: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="chart-card report-section">
      <div className="panel-title">
        <div>
          <small>{kicker}</small>
          <h2>{title}</h2>
        </div>
        {aside ? <span>{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

export type BarItem = { rotulo: string; valor: Cell };

/**
 * Gráfico de barras em CSS puro (`.bar-chart`). Sem biblioteca: o design system
 * já desenha a grade, e trocar isto por Recharts obrigaria a reescrevê-lo.
 *
 * Barra de célula suprimida fica na altura mínima e o valor sai como "—":
 * inferir a altura a partir do número suprimido devolveria o número.
 */
export function Bars({ items }: { items: readonly BarItem[] }) {
  const maior = items.reduce((max, item) => Math.max(max, item.valor ?? 0), 0);

  if (items.length === 0) return <Empty>Sem dados no período.</Empty>;

  return (
    <div className="bar-chart">
      {items.map(item => (
        <div key={item.rotulo}>
          <b>{cell(item.valor)}</b>
          <i
            style={{
              height:
                item.valor === null || maior === 0
                  ? "5px"
                  : `${Math.max(5, Math.round((item.valor / maior) * 120))}px`,
            }}
          />
          <small title={item.rotulo}>{item.rotulo}</small>
        </div>
      ))}
    </div>
  );
}

export type RowItem = { rotulo: string; valor: Cell; de: Cell };

/**
 * Lista com barra proporcional (`.category-row`). O `<u>` é a parte preenchida
 * do `<em>`; célula suprimida não preenche nada.
 */
export function Rows({ items }: { items: readonly RowItem[] }) {
  if (items.length === 0) return <Empty>Sem dados no período.</Empty>;

  return (
    <div className="categories">
      {items.map((item, index) => (
        <div className="category-row" key={item.rotulo}>
          <i className={`dot d${(index % 4) + 1}`} />
          <span>{item.rotulo}</span>
          <b>{cell(item.valor)}</b>
          <em>
            <u style={{ width: barWidth(item.valor, item.de) }} />
          </em>
        </div>
      ))}
    </div>
  );
}

/** Selo `.risk`. A severidade chega como texto do banco e pode ser nula. */
export function RiskTag({ value }: { value: string | null }) {
  const risk = asRisk(value);
  if (!risk) return <>{SUPPRESSED}</>;
  return <span className={riskClass(risk)}>{RISK_LABEL[risk]}</span>;
}

export type Column = { key: string; label: string; num?: boolean };

/**
 * Tabela. Uma célula cujo conteúdo é "—" ganha `.void` para se ler como
 * ausência deliberada e não como zero esquecido.
 */
export function Table({
  columns,
  rows,
}: {
  columns: readonly Column[];
  rows: readonly Record<string, ReactNode>[];
}) {
  if (rows.length === 0) return <Empty>Sem dados no período.</Empty>;

  return (
    <div className="report-table">
      <table>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key} className={column.num ? "num" : undefined} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.__key ?? index)}>
              {columns.map(column => (
                <td
                  key={column.key}
                  className={
                    [column.num ? "num" : "", row[column.key] === SUPPRESSED ? "void" : ""]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                >
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="list-head">
      <span>{children}</span>
      <small>Nada a mostrar</small>
    </div>
  );
}

/**
 * A nota de rodapé que explica os "—".
 *
 * Não é polimento: sem ela o leitor lê "—" como "zero" e conclui que a unidade
 * não teve relato nenhum. O texto diz o limiar real da organização, e diz que a
 * supressão acontece na consulta — é a diferença entre relatório agregado e
 * vetor de reidentificação.
 */
export function SuppressionNote({ minCell }: { minCell: number }) {
  return (
    <div className="privacy-note report-section">
      <b>Por que existem células com “{SUPPRESSED}”</b>
      <p>
        Toda contagem menor que {minCell} é suprimida <strong>na própria consulta</strong> ao banco,
        por <code>suppress_small_cell()</code>. O número não chega a esta tela nem ao arquivo
        exportado. Numa unidade pequena, um único caso de assédio identificaria quem relatou para o
        gestor que lê o relatório — “{SUPPRESSED}” significa “entre 1 e {minCell - 1}, ou zero”, e é
        assim de propósito. O limiar é <code>min_cell_size</code> da organização.
      </p>
    </div>
  );
}
