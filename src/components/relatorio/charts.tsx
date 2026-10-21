import { mesCurto } from "@/lib/admin/relatorioMensalTipos";

/**
 * Gráficos do relatório mensal — SVG/CSS puros, sem biblioteca, sem estado.
 * Rodam no servidor e saem idênticos no papel.
 *
 * Regras de leitura: uma série só (sem legenda inútil), valor escrito junto da
 * marca (nunca só cor), rótulo em tinta de texto e não na cor da série, e o
 * mês do relatório destacado no vermelho da marca contra o cinza dos demais.
 */

/** Rampa ordenada de risco: um matiz só, do claro ao escuro. Baixo → crítico. */
export const RISK_COLOR: Record<string, string> = {
  baixo: "#efc3c0",
  moderado: "#e38c86",
  alto: "#cc3d36",
  critico: "#8f0f0a",
};

/* ── evolução dos últimos 12 meses ────────────────────────────────────────── */

export function Columns({
  serie,
  destaque,
}: {
  serie: { mes: string; total: number }[];
  destaque: string;
}) {
  const maximo = Math.max(1, ...serie.map(item => item.total));
  const L = 640;
  const A = 190;
  const base = 158;
  const topo = 24;
  const passo = L / serie.length;
  const largura = Math.min(34, passo - 14);

  return (
    <svg
      className="mr-columns"
      viewBox={`0 0 ${L} ${A}`}
      role="img"
      aria-label={`Relatos recebidos por mês, de ${mesCurto(serie[0].mes)} a ${mesCurto(serie[serie.length - 1].mes)}`}
    >
      <line x1="0" x2={L} y1={base} y2={base} stroke="#cfd5d2" strokeWidth="1" />
      {serie.map((item, i) => {
        const altura = item.total === 0 ? 0 : Math.max(4, ((base - topo) * item.total) / maximo);
        const x = i * passo + (passo - largura) / 2;
        const atual = item.mes === destaque;
        return (
          <g key={item.mes}>
            <title>{`${mesCurto(item.mes)}: ${item.total} ${item.total === 1 ? "relato" : "relatos"}`}</title>
            {altura > 0 ? (
              <rect
                x={x}
                y={base - altura}
                width={largura}
                height={altura}
                rx="4"
                fill={atual ? "#d81f18" : "#c9cfcc"}
              />
            ) : null}
            <text
              x={x + largura / 2}
              y={base - altura - 6}
              textAnchor="middle"
              className={atual ? "mr-col-val atual" : "mr-col-val"}
            >
              {item.total}
            </text>
            <text x={x + largura / 2} y={base + 18} textAnchor="middle" className={atual ? "mr-col-mes atual" : "mr-col-mes"}>
              {mesCurto(item.mes)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── barras horizontais (categorias, situação) ────────────────────────────── */

export function HBars({ itens }: { itens: { rotulo: string; total: number }[] }) {
  const maximo = Math.max(1, ...itens.map(item => item.total));
  return (
    <ul className="mr-hbars">
      {itens.map(item => (
        <li key={item.rotulo}>
          <span>{item.rotulo}</span>
          <b>{item.total}</b>
          <i style={{ width: `${Math.max(3, (item.total / maximo) * 100)}%` }} />
        </li>
      ))}
    </ul>
  );
}

/* ── rosca (nível de risco) ───────────────────────────────────────────────── */

export function Donut({ itens }: { itens: { chave: string; rotulo: string; total: number }[] }) {
  const soma = itens.reduce((acc, item) => acc + item.total, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  const folga = itens.length > 1 ? 3 : 0;
  const partes = itens.map(item => (item.total / soma) * C);
  const inicios = partes.map((_, i) => partes.slice(0, i).reduce((acc, parte) => acc + parte, 0));

  return (
    <div className="mr-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="Relatos por nível de risco">
        <circle cx="70" cy="70" r={R} fill="none" stroke="#eef0ee" strokeWidth="20" />
        {itens.map((item, i) => {
          const visivel = Math.max(0, partes[i] - folga);
          return (
            <circle
              key={item.chave}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={RISK_COLOR[item.chave] ?? "#9aa5a2"}
              strokeWidth="20"
              strokeDasharray={`${visivel} ${C - visivel}`}
              strokeDashoffset={-inicios[i]}
              transform="rotate(-90 70 70)"
            >
              <title>{`${item.rotulo}: ${item.total}`}</title>
            </circle>
          );
        })}
        <text x="70" y="68" textAnchor="middle" className="mr-donut-num">
          {soma}
        </text>
        <text x="70" y="85" textAnchor="middle" className="mr-donut-sub">
          relatos
        </text>
      </svg>
      <ul>
        {itens.map(item => (
          <li key={item.chave}>
            <i style={{ background: RISK_COLOR[item.chave] ?? "#9aa5a2" }} />
            <span>{item.rotulo}</span>
            <b>{item.total}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── medidor de percentual ────────────────────────────────────────────────── */

export function Meter({ pct, rotulo }: { pct: number; rotulo: string }) {
  return (
    <div className="mr-meter" role="img" aria-label={`${rotulo}: ${pct}%`}>
      <i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}
