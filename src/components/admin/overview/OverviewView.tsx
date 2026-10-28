import Link from "next/link";

import {
  RISK_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  formatDate,
  type ReportStatus,
  type RiskLevel,
} from "@/lib/admin/labels";

import {
  IconArrowRight,
  IconChevronRight,
  IconClock,
  IconDoc,
  IconFlame,
  IconInbox,
  IconShield,
} from "../shell/AdminIcons";

export type OverviewData = {
  saudacao: string;
  primeiroNome: string;
  orgName: string;
  /** `null` = protegido (poucos casos) ou indisponível; nunca significa zero. */
  abertos: number | null;
  triagem: number | null;
  criticos: number | null;
  total: number | null;
  porStatus: Record<ReportStatus, number | null>;
  /** Só a visão completa lista relatos; o Comitê nunca. */
  recentes: { id: string; protocol: string; status: ReportStatus; risk: RiskLevel; createdAt: string }[];
  /** Só quem enxerga "Denúncias" na grade de permissões recebe o atalho e os links dos casos. */
  podeVerDenuncias: boolean;
  /** Comitê: só números, sem lista de relatos. */
  modo?: "completo" | "comite";
  /** Menor contagem exibida (proteção de célula pequena). */
  minimo?: number;
  /** As contagens não puderam ser carregadas. */
  indisponivel?: boolean;
};

const COR_STATUS: Record<ReportStatus, string> = {
  em_triagem: "ad-s1",
  em_apuracao: "ad-s2",
  aguardando_informacao: "ad-s3",
  concluida: "ad-s4",
  arquivada: "ad-s5",
};

const dois = (valor: number | null) => (valor === null ? "—" : String(valor).padStart(2, "0"));
const pct = (parte: number | null, todo: number | null) =>
  parte !== null && todo !== null && todo > 0 ? Math.round((parte / todo) * 100) : 0;

/** Visão geral da empresa ativa. Só apresenta: quem busca os números é a página. */
export default function OverviewView({ dados }: { dados: OverviewData }) {
  const { abertos, triagem, criticos, total, porStatus, recentes } = dados;
  const comite = dados.modo === "comite";
  const minimo = dados.minimo ?? 5;
  const protegido = dados.indisponivel ? "indisponível agora" : `protegido: menos de ${minimo} casos`;
  const statusVisivel = STATUS_ORDER.every(status => porStatus[status] !== null);

  return (
    <div className="ad-wrap">
      <div className="ad-hero">
        <div>
          <h2>
            {dados.saudacao}, {dados.primeiroNome}.{" "}
            {dados.indisponivel ? (
              <b>As contagens estão indisponíveis agora.</b>
            ) : criticos !== null && criticos > 0 ? (
              <b>
                {criticos} caso{criticos > 1 ? "s" : ""} crítico{criticos > 1 ? "s" : ""} em aberto.
              </b>
            ) : abertos !== null && abertos > 0 ? (
              <b>
                {abertos} caso{abertos > 1 ? "s" : ""} em aberto.
              </b>
            ) : abertos === 0 ? (
              <b>Nenhum caso em aberto.</b>
            ) : (
              <b>Indicadores protegidos para preservar o anonimato.</b>
            )}
          </h2>
          <p>
            <i aria-hidden="true" />
            {comite
              ? `Somente contagens · ${dados.orgName} · sem acesso aos relatos individuais`
              : `Dados agregados e protegidos · ${dados.orgName}`}
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
          <span className="ad-leg">
            {abertos === null ? protegido : total !== null ? `de ${total} no total` : ""}
          </span>
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
          <span className="ad-leg">{triagem === null ? protegido : "aguardando primeira análise"}</span>
          <span className="ad-bar" aria-hidden="true">
            <i style={{ "--w": `${pct(triagem, abertos)}%` } as React.CSSProperties} />
          </span>
        </article>
        <article className={`ad-kpi ${criticos !== null && criticos > 0 ? "attention" : ""}`}>
          <div className="ad-kpi-head">
            <small>CASOS CRÍTICOS</small>
            <span className="ad-ico" aria-hidden="true">
              <IconFlame />
            </span>
          </div>
          <strong>{dois(criticos)}</strong>
          <span className="ad-leg">
            {criticos === null ? protegido : criticos > 0 ? "ação imediata" : "nenhum no momento"}
          </span>
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
          <span className="ad-leg">{total === null ? protegido : "desde a abertura do canal"}</span>
          <span className="ad-bar" aria-hidden="true">
            <i style={{ "--w": total !== null && total > 0 ? "100%" : "0%" } as React.CSSProperties} />
          </span>
        </article>
      </div>

      {total !== null && total > 0 ? (
        <div className={comite ? "" : "ad-two"} style={comite ? { marginTop: 16 } : undefined}>
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <small>TRATATIVAS</small>
                <h3>Status dos relatos</h3>
              </div>
            </div>
            {statusVisivel ? (
              <>
                <div className="ad-seg" role="img" aria-label="Distribuição dos relatos por status">
                  {STATUS_ORDER.map(status => (
                    <i
                      key={status}
                      className={COR_STATUS[status]}
                      style={{ "--w": `${((porStatus[status] ?? 0) / total) * 100}%` } as React.CSSProperties}
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
              </>
            ) : (
              <p className="ad-protected">
                <IconShield size={18} />
                <span>
                  {dados.indisponivel
                    ? "A distribuição por situação está indisponível agora."
                    : `A distribuição por situação fica oculta enquanto algum grupo tem menos de ${minimo} casos, para preservar o anonimato de quem relatou.`}
                </span>
              </p>
            )}
          </section>

          {comite ? null : (
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
          )}
        </div>
      ) : (
        <div className="ad-empty" style={{ marginTop: 16 }}>
          <span className="ad-ico" aria-hidden="true">
            <IconInbox size={24} />
          </span>
          <small>{dados.indisponivel ? "INDISPONÍVEL" : "CANAL ATIVO"}</small>
          <h2>{dados.indisponivel ? "Não foi possível carregar as contagens." : "Nenhum relato recebido ainda."}</h2>
          <p>
            {dados.indisponivel
              ? "Tente novamente em instantes. Se continuar, avise quem administra o canal."
              : "Quando alguém enviar um relato pelo canal público, ele aparecerá aqui. Estes números vêm direto do banco."}
          </p>
        </div>
      )}
      {comite ? (
        <p className="ad-comite-nota">
          <IconShield size={16} />
          <span>
            O Comitê acompanha somente contagens. O conteúdo dos relatos e as investigações ficam fora do seu
            acesso, por regra do canal.
          </span>
        </p>
      ) : null}
    </div>
  );
}
