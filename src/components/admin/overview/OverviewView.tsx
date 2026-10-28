import Link from "next/link";

import {
  RISK_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  formatDate,
  type ReportStatus,
  type RiskLevel,
} from "@/lib/admin/labels";

import { IconArrowRight, IconChevronRight, IconClock, IconFlame, IconInbox, IconDoc } from "../shell/AdminIcons";

export type OverviewData = {
  saudacao: string;
  primeiroNome: string;
  orgName: string;
  abertos: number;
  triagem: number;
  criticos: number;
  total: number;
  porStatus: Record<ReportStatus, number>;
  recentes: { id: string; protocol: string; status: ReportStatus; risk: RiskLevel; createdAt: string }[];
  /** Só quem enxerga "Denúncias" na grade de permissões recebe o atalho e os links dos casos. */
  podeVerDenuncias: boolean;
};

const COR_STATUS: Record<ReportStatus, string> = {
  em_triagem: "ad-s1",
  em_apuracao: "ad-s2",
  aguardando_informacao: "ad-s3",
  concluida: "ad-s4",
  arquivada: "ad-s5",
};

const dois = (valor: number) => String(valor).padStart(2, "0");
const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);

/** Visão geral da empresa ativa. Só apresenta: quem busca os números é a página. */
export default function OverviewView({ dados }: { dados: OverviewData }) {
  const { abertos, triagem, criticos, total, porStatus, recentes } = dados;

  return (
    <div className="ad-wrap">
      <div className="ad-hero">
        <div>
          <h2>
            {dados.saudacao}, {dados.primeiroNome}.{" "}
            {criticos > 0 ? (
              <b>
                {criticos} caso{criticos > 1 ? "s" : ""} crítico{criticos > 1 ? "s" : ""} em aberto.
              </b>
            ) : abertos > 0 ? (
              <b>
                {abertos} caso{abertos > 1 ? "s" : ""} em aberto.
              </b>
            ) : (
              <b>Nenhum caso em aberto.</b>
            )}
          </h2>
          <p>
            <i aria-hidden="true" />
            Dados agregados e protegidos · {dados.orgName}
          </p>
        </div>
        {dados.podeVerDenuncias ? (
          <Link className="ad-btn" href="/admin/denuncias">
            Abrir caixa de entrada
            <span className="ad-btn-arrow" aria-hidden="true">
              <IconArrowRight />
            </span>
          </Link>
        ) : null}
      </div>

      <div className="ad-kpis">
        <article className="ad-kpi">
          <div className="ad-kpi-head">
            <small>CASOS ABERTOS</small>
            <span className="ad-ico" aria-hidden="true">
              <IconInbox />
            </span>
          </div>
          <strong>{dois(abertos)}</strong>
          <span className="ad-leg">de {total} no total</span>
          <span className="ad-bar" aria-hidden="true">
            <i style={{ "--w": `${pct(abertos, total)}%` } as React.CSSProperties} />
          </span>
        </article>
        <article className="ad-kpi">
          <div className="ad-kpi-head">
            <small>EM TRIAGEM</small>
            <span className="ad-ico" aria-hidden="true">
              <IconClock />
            </span>
          </div>
          <strong>{dois(triagem)}</strong>
          <span className="ad-leg">aguardando primeira análise</span>
          <span className="ad-bar" aria-hidden="true">
            <i style={{ "--w": `${pct(triagem, abertos)}%` } as React.CSSProperties} />
          </span>
        </article>
        <article className={`ad-kpi ${criticos > 0 ? "attention" : ""}`}>
          <div className="ad-kpi-head">
            <small>CASOS CRÍTICOS</small>
            <span className="ad-ico" aria-hidden="true">
              <IconFlame />
            </span>
          </div>
          <strong>{dois(criticos)}</strong>
          <span className="ad-leg">{criticos > 0 ? "ação imediata" : "nenhum no momento"}</span>
          <span className="ad-bar" aria-hidden="true">
            <i style={{ "--w": `${pct(criticos, abertos)}%` } as React.CSSProperties} />
          </span>
        </article>
        <article className="ad-kpi">
          <div className="ad-kpi-head">
            <small>TOTAL RECEBIDO</small>
            <span className="ad-ico" aria-hidden="true">
              <IconDoc />
            </span>
          </div>
          <strong>{dois(total)}</strong>
          <span className="ad-leg">desde a abertura do canal</span>
          <span className="ad-bar" aria-hidden="true">
            <i style={{ "--w": total > 0 ? "100%" : "0%" } as React.CSSProperties} />
          </span>
        </article>
      </div>

      {total > 0 ? (
        <div className="ad-two">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <small>TRATATIVAS</small>
                <h3>Status dos relatos</h3>
              </div>
            </div>
            <div className="ad-seg" role="img" aria-label="Distribuição dos relatos por status">
              {STATUS_ORDER.map(status => (
                <i
                  key={status}
                  className={COR_STATUS[status]}
                  style={{ "--w": `${(porStatus[status] / total) * 100}%` } as React.CSSProperties}
                />
              ))}
            </div>
            <ul className="ad-st">
              {STATUS_ORDER.map(status => (
                <li key={status}>
                  <i className={`dot ${COR_STATUS[status]}`} aria-hidden="true" />
                  <span className="nm">{STATUS_LABEL[status]}</span>
                  <b>{porStatus[status]}</b>
                  <span className="pc">{pct(porStatus[status], total)}%</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <small>MAIS RECENTES</small>
                <h3>Últimos relatos</h3>
              </div>
              {dados.podeVerDenuncias ? (
                <Link className="ad-pill" href="/admin/denuncias">
                  Ver todos
                  <IconChevronRight />
                </Link>
              ) : null}
            </div>
            <ul className="ad-cases">
              {recentes.map(caso => {
                const conteudo = (
                  <>
                    <span className={`ad-risk r-${caso.risk}`}>{RISK_LABEL[caso.risk]}</span>
                    <span className="ad-case-tx">
                      <b>{STATUS_LABEL[caso.status]}</b>
                      <small>{caso.protocol}</small>
                    </span>
                    <time dateTime={caso.createdAt}>{formatDate(caso.createdAt)}</time>
                    {dados.podeVerDenuncias ? <IconChevronRight /> : null}
                  </>
                );
                return (
                  <li key={caso.id}>
                    {dados.podeVerDenuncias ? (
                      <Link className="ad-case" href={`/admin/denuncias/${caso.id}`}>
                        {conteudo}
                      </Link>
                    ) : (
                      <div className="ad-case">{conteudo}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      ) : (
        <div className="ad-empty" style={{ marginTop: 16 }}>
          <span className="ad-ico" aria-hidden="true">
            <IconInbox size={24} />
          </span>
          <small>CANAL ATIVO</small>
          <h2>Nenhum relato recebido ainda.</h2>
          <p>
            Quando alguém enviar um relato pelo canal público, ele aparecerá aqui e na caixa de
            entrada. Nada é gerado automaticamente: estes números vêm direto do banco.
          </p>
        </div>
      )}
    </div>
  );
}
