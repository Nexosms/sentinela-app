import type { ReactNode } from "react";

import { formatHours } from "@/lib/admin/relatorios";
import {
  mesCurto,
  mesPorExtenso,
  somarMeses,
  type Indicadores,
  type MonthlyMetrics,
} from "@/lib/admin/relatorioMensalTipos";

import BrandMark from "./BrandMark";
import { Columns, Donut, HBars, Meter } from "./charts";

/**
 * O dashboard do relatório mensal. Componente PURO: recebe o relatório já
 * calculado e protegido (o que está em `report_snapshots.metrics`) e só o
 * desenha. Não consulta banco, então a tela do cliente, a pré-visualização da
 * Nexo e a versão impressa saem do mesmo código com os mesmos números.
 *
 * Um `null` em qualquer indicador quer dizer "protegido por poucos relatos",
 * nunca "carregando".
 */

const PROTEGIDO = "Protegido";

function pctTexto(parte: number | null, todo: number): string | null {
  if (parte === null || todo <= 0) return null;
  return `${Math.round((parte / todo) * 100)}% do total`;
}

function Card({
  rotulo,
  valor,
  nota,
  anterior,
  destaque,
  grande,
}: {
  rotulo: string;
  valor: number | null;
  nota?: ReactNode;
  anterior?: number | null;
  destaque?: boolean;
  grande?: boolean;
}) {
  const protegido = valor === null;
  return (
    <article className={`mr-card${destaque ? " destaque" : ""}${grande ? " grande" : ""}${protegido ? " protegido" : ""}`}>
      <small>{rotulo}</small>
      {protegido ? (
        <strong title="Poucos relatos neste mês: o número é protegido para não identificar ninguém.">
          {PROTEGIDO}
        </strong>
      ) : (
        <strong>{valor}</strong>
      )}
      <span className="mr-card-nota">
        {protegido ? "poucos relatos no mês" : nota}
        {!protegido && anterior !== null && anterior !== undefined ? (
          <em>
            {nota ? " · " : ""}mês anterior: {anterior}
          </em>
        ) : null}
      </span>
    </article>
  );
}

function Variacao({ atual, anterior, rotuloAnterior }: { atual: number; anterior: number; rotuloAnterior: string }) {
  const dif = atual - anterior;
  if (dif === 0) return <span className="mr-var igual">= igual a {rotuloAnterior} ({anterior})</span>;
  return (
    <span className="mr-var">
      {dif > 0 ? "▲" : "▼"} {Math.abs(dif)} {dif > 0 ? "a mais" : "a menos"} que {rotuloAnterior} ({anterior})
    </span>
  );
}

function Protegida({ texto }: { texto: string }) {
  return (
    <p className="mr-protegida">{texto}</p>
  );
}

function indicadorAnterior(anterior: Indicadores, campo: keyof Indicadores): number | null {
  const valor = anterior[campo];
  return typeof valor === "number" ? valor : null;
}

export default function MonthlyDashboard({
  metrics,
  rascunho = false,
  acoes,
}: {
  metrics: MonthlyMetrics;
  /** Pré-visualização da Nexo: marca d'água "RASCUNHO", nada disso vai ao cliente. */
  rascunho?: boolean;
  /** Botões da tela (ex.: Baixar PDF). Somem na impressão. */
  acoes?: ReactNode;
}) {
  const { atual, anterior, tempos, categorias } = metrics;
  const total = atual.total;
  const mesAnterior = somarMeses(metrics.mes, -1);
  const rotuloAnterior = mesPorExtenso(mesAnterior).split(" de ")[0].toLowerCase();
  const vazio = total === 0;
  const geradoEm = new Date(metrics.geradoEm).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <article className={`mr-sheet${rascunho ? " rascunho" : ""}`} aria-label={`Relatório mensal de ${mesPorExtenso(metrics.mes)}`}>
      <header className="mr-head">
        <div className="mr-head-brand">
          <BrandMark />
          <div>
            <small>CDN · CANAL DE DENÚNCIAS</small>
            <span>Prevenção e gestão de riscos organizacionais</span>
          </div>
        </div>
        <div className="mr-head-title">
          <small>RELATÓRIO MENSAL</small>
          <h1>{mesPorExtenso(metrics.mes)}</h1>
          <p>
            <b>{metrics.empresa.nome}</b>
            {metrics.empresa.cnpj ? <span> · {metrics.empresa.cnpj}</span> : null}
          </p>
        </div>
        {acoes ? <div className="mr-head-actions no-print">{acoes}</div> : null}
      </header>

      {rascunho ? (
        <p className="mr-aviso no-print">
          Rascunho — o cliente ainda não vê este relatório. Libere em Clientes → Relatórios mensais.
        </p>
      ) : null}

      <section className="mr-kpis" aria-label="Indicadores do mês">
        <article className="mr-card destaque grande">
          <small>RELATOS RECEBIDOS</small>
          <strong>{total}</strong>
          <span className="mr-card-nota">
            {anterior ? (
              <Variacao atual={total} anterior={anterior.total} rotuloAnterior={rotuloAnterior} />
            ) : (
              <span className="mr-var">Primeiro mês no canal</span>
            )}
          </span>
        </article>
        <Card
          rotulo="ANÔNIMOS"
          valor={atual.anonimas}
          nota={pctTexto(atual.anonimas, total)}
          anterior={anterior ? indicadorAnterior(anterior, "anonimas") : null}
        />
        <Card
          rotulo="CASOS CRÍTICOS"
          valor={atual.criticos}
          nota="recebidos no mês"
          anterior={anterior ? indicadorAnterior(anterior, "criticos") : null}
        />
        <Card
          rotulo="EM ANDAMENTO"
          valor={atual.abertos}
          nota={
            atual.emTriagem !== null && atual.emTriagem > 0
              ? `${atual.emTriagem} em triagem`
              : "situação hoje"
          }
        />
        <Card
          rotulo="ENCERRADOS"
          valor={atual.encerrados}
          nota={pctTexto(atual.encerrados, total)}
        />
      </section>

      {vazio ? (
        <section className="mr-vazio">
          <span aria-hidden="true">◇</span>
          <h2>Nenhum relato recebido em {mesPorExtenso(metrics.mes)}.</h2>
          <p>
            O canal esteve ativo e monitorado durante todo o mês. Ausência de relatos não é, por si só,
            ausência de problemas: o foco continua sendo manter o canal conhecido e confiável.
          </p>
        </section>
      ) : null}

      <section className="mr-card-wide">
        <div className="mr-title">
          <small>EVOLUÇÃO</small>
          <h2>
            {metrics.serie.length >= 12
              ? "Relatos recebidos nos últimos 12 meses"
              : `Relatos recebidos desde ${mesPorExtenso(metrics.serie[0].mes)}`}
          </h2>
        </div>
        {metrics.serie.length < 2 ? (
          <p className="mr-rodape-card">
            Este é o primeiro mês da empresa no canal. A evolução mês a mês aparece a partir do próximo
            relatório.
          </p>
        ) : (
          <>
            <Columns serie={metrics.serie} destaque={metrics.mes} />
            <details className="mr-tabela no-print">
              <summary>Ver como tabela</summary>
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Relatos</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.serie.map(item => (
                    <tr key={item.mes}>
                      <td>{mesCurto(item.mes)}</td>
                      <td>{item.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </section>

      {vazio ? null : (
        <div className="mr-grid">
          <section className="mr-card-wide">
            <div className="mr-title">
              <small>GRAVIDADE</small>
              <h2>Relatos por nível de risco</h2>
            </div>
            {atual.porRisco.visivel ? (
              <Donut itens={atual.porRisco.itens} />
            ) : (
              <Protegida texto="Poucos relatos em algum nível de risco neste mês. A divisão fica protegida para não identificar ninguém." />
            )}
          </section>

          <section className="mr-card-wide">
            <div className="mr-title">
              <small>ANDAMENTO</small>
              <h2>Situação dos relatos do mês</h2>
            </div>
            {atual.porSituacao.visivel ? (
              <HBars itens={atual.porSituacao.itens} />
            ) : (
              <Protegida texto="Poucos relatos em alguma situação neste mês. A divisão fica protegida para não identificar ninguém." />
            )}
          </section>

          <section className="mr-card-wide">
            <div className="mr-title">
              <small>TEMAS</small>
              <h2>Categorias mais citadas</h2>
            </div>
            {categorias.itens.length > 0 ? (
              <HBars itens={categorias.itens} />
            ) : (
              <Protegida texto="Nenhuma categoria atingiu o mínimo de relatos para ser exibida neste mês." />
            )}
            {categorias.itens.length > 0 && categorias.ocultas ? (
              <p className="mr-rodape-card">Há outras categorias com poucos relatos, ocultas por proteção.</p>
            ) : null}
            <p className="mr-rodape-card">Um relato pode citar mais de uma categoria.</p>
          </section>

          <section className="mr-card-wide">
            <div className="mr-title">
              <small>PRAZOS</small>
              <h2>Tempo de resposta</h2>
            </div>
            <div className="mr-tempos">
              <div>
                <span>Triados dentro do prazo ({formatHours(tempos.slaTriagemHoras)})</span>
                {tempos.triagemNoPrazoPct === null ? (
                  <strong className="protegido">{PROTEGIDO}</strong>
                ) : (
                  <>
                    <strong>{tempos.triagemNoPrazoPct}%</strong>
                    <Meter pct={tempos.triagemNoPrazoPct} rotulo="Triados dentro do prazo" />
                  </>
                )}
              </div>
              <div>
                <span>Tempo mediano até a triagem</span>
                <strong className={tempos.medianaTriagemH === null ? "protegido" : ""}>
                  {tempos.medianaTriagemH === null ? PROTEGIDO : formatHours(tempos.medianaTriagemH)}
                </strong>
              </div>
              <div>
                <span>Concluídos dentro do prazo ({formatHours(tempos.slaApuracaoHoras)})</span>
                {tempos.conclusaoNoPrazoPct === null ? (
                  <strong className="protegido">{PROTEGIDO}</strong>
                ) : (
                  <>
                    <strong>{tempos.conclusaoNoPrazoPct}%</strong>
                    <Meter pct={tempos.conclusaoNoPrazoPct} rotulo="Concluídos dentro do prazo" />
                  </>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      <footer className="mr-foot">
        <p>
          <b>Como ler.</b> Este relatório traz apenas números agregados: nenhum relato, protocolo, texto ou
          dado de quem relatou aparece aqui. O total do mês é sempre exato. Quando um recorte teria menos de{" "}
          {metrics.minimo} relatos, ele é marcado como <b>{PROTEGIDO.toLowerCase()}</b> — assim ninguém
          consegue deduzir quem relatou. A situação dos relatos é a de {geradoEm}.
        </p>
        <p className="mr-assinatura">
          <BrandMark size={18} /> Canal de Denúncias · Nexo Soluções · gerado em {geradoEm}
        </p>
      </footer>
    </article>
  );
}
