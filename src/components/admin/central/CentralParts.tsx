import Link from "next/link";

import { abrirCaso } from "@/app/admin/central/actions";
import { RISK_LABEL, STATUS_LABEL } from "@/lib/admin/labels";
import {
  FILA_FILTROS,
  haQuanto,
  iniciais,
  prazoInfo,
  type FilaFiltro,
  type FilaItem,
} from "@/lib/admin/centralFila";
import type { EmpresaResumo } from "@/lib/admin/central";
import { trocarOrganizacaoAtiva } from "@/lib/org/actions";

import {
  IconBuilding,
  IconChevronDown,
  IconChevronRight,
  IconClock,
  IconFlame,
  IconInbox,
  IconShield,
} from "../shell/AdminIcons";

const dois = (valor: number) => String(valor).padStart(2, "0");
const pct = (parte: number, todo: number) =>
  todo > 0 ? `${Math.max(2, Math.round((parte / todo) * 100))}%` : "0%";

export function CentralKpis({
  kpis,
}: {
  kpis: {
    empresasAtivas: number;
    empresasComItens: number;
    abertos: number;
    criticos: number;
    vencidos: number;
  };
}) {
  return (
    <div className="ad-kpis">
      <article className="ad-kpi">
        <div className="ad-kpi-head">
          <small>EMPRESAS ATIVAS</small>
          <span className="ad-ico" aria-hidden="true">
            <IconBuilding />
          </span>
        </div>
        <strong>{kpis.empresasAtivas}</strong>
        <span className="ad-leg">{kpis.empresasComItens} com itens para conferir hoje</span>
        <span className="ad-bar" aria-hidden="true">
          <i style={{ "--w": pct(kpis.empresasComItens, kpis.empresasAtivas) } as React.CSSProperties} />
        </span>
      </article>
      <article className="ad-kpi">
        <div className="ad-kpi-head">
          <small>RELATOS EM ABERTO</small>
          <span className="ad-ico" aria-hidden="true">
            <IconInbox />
          </span>
        </div>
        <strong>{kpis.abertos}</strong>
        <span className="ad-leg">em todas as empresas</span>
        <span className="ad-bar" aria-hidden="true">
          <i style={{ "--w": kpis.abertos > 0 ? "100%" : "0%" } as React.CSSProperties} />
        </span>
      </article>
      <article className={`ad-kpi ${kpis.criticos > 0 ? "attention" : ""}`}>
        <div className="ad-kpi-head">
          <small>CRÍTICOS EM ABERTO</small>
          <span className="ad-ico" aria-hidden="true">
            <IconFlame />
          </span>
        </div>
        <strong>{dois(kpis.criticos)}</strong>
        <span className="ad-leg">{kpis.criticos > 0 ? "ação imediata" : "nenhum no momento"}</span>
        <span className="ad-bar" aria-hidden="true">
          <i style={{ "--w": pct(kpis.criticos, kpis.abertos) } as React.CSSProperties} />
        </span>
      </article>
      <article className={`ad-kpi ${kpis.vencidos > 0 ? "warn" : ""}`}>
        <div className="ad-kpi-head">
          <small>PRAZO VENCIDO</small>
          <span className="ad-ico" aria-hidden="true">
            <IconClock />
          </span>
        </div>
        <strong>{dois(kpis.vencidos)}</strong>
        <span className="ad-leg">{kpis.vencidos > 0 ? "precisam de resposta hoje" : "nenhum no momento"}</span>
        <span className="ad-bar" aria-hidden="true">
          <i style={{ "--w": pct(kpis.vencidos, kpis.abertos) } as React.CSSProperties} />
        </span>
      </article>
    </div>
  );
}

/** Tabela da fila. Toda ela é um formulário: o botão de cada linha abre aquele relato na empresa dele. */
export function QueueTable({ itens, agora }: { itens: FilaItem[]; agora: Date }) {
  if (itens.length === 0) {
    return <p className="ct-empty">Nada pede atenção com este filtro. Bom sinal.</p>;
  }
  return (
    <form action={abrirCaso}>
      <div className="ct-tabwrap">
        <table className="ct-table">
          <thead>
            <tr>
              <th>Risco</th>
              <th>Empresa</th>
              <th>Protocolo</th>
              <th>Situação</th>
              <th>Prazo</th>
              <th>Responsável</th>
              <th>
                <span className="ad-sr">Abrir</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {itens.map(item => {
              const prazo = prazoInfo(item.dueAt, agora);
              return (
                <tr key={item.id}>
                  <td>
                    <span className={`ad-risk r-${item.risk}`}>{RISK_LABEL[item.risk]}</span>
                  </td>
                  <td className="ct-emp">
                    <span className="ct-sg" aria-hidden="true">
                      {iniciais(item.orgName)}
                    </span>
                    <b>{item.orgName}</b>
                  </td>
                  <td className="ct-proto">{item.protocol}</td>
                  <td className="ct-st">{STATUS_LABEL[item.status]}</td>
                  <td className={`ct-pz ${prazo.tom}`}>{prazo.rotulo}</td>
                  <td className={`ct-rs ${item.assignedTo ? "" : "sem"}`}>
                    {item.assignedTo ? (item.assigneeName ?? "Atribuído") : "Sem responsável"}
                  </td>
                  <td className="ct-act">
                    <button
                      className="ct-open"
                      type="submit"
                      name="caso"
                      value={`${item.orgId}:${item.id}`}
                      aria-label={`Abrir ${item.protocol} em ${item.orgName}`}
                      title="Abrir o relato"
                    >
                      <IconChevronRight />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}

export function SigiloNota() {
  return (
    <p className="ct-note">
      <IconShield size={16} />
      <span>
        A fila mostra só risco, situação, prazo e responsável. O texto do relato e a identidade não
        aparecem aqui; abrir um caso segue a trilha de auditoria de sempre.
      </span>
    </p>
  );
}

/** Cartões das empresas. Clicar entra na empresa (mesma ação do seletor do menu). */
export function CompanyGrid({ empresas, agora }: { empresas: EmpresaResumo[]; agora: Date }) {
  return (
    <div className="ct-companies">
      {empresas.map(empresa => (
        <form action={trocarOrganizacaoAtiva} className="ct-form" key={empresa.orgId}>
          <input type="hidden" name="orgId" value={empresa.orgId} />
          <button
            type="submit"
            className={`ct-company ${empresa.criticos > 0 ? "urg" : ""}`}
            aria-label={`Abrir a empresa ${empresa.nome}`}
          >
            <span className="ct-sg" aria-hidden="true">
              {iniciais(empresa.nome)}
            </span>
            <span className="ct-company-tx">
              <b>{empresa.nome}</b>
              <small>
                {empresa.ultimaAtividade
                  ? `Última atividade ${haQuanto(empresa.ultimaAtividade, agora)}`
                  : "Sem atividade em aberto"}
              </small>
            </span>
            <span className="ct-company-n">
              <i>{empresa.abertos}</i>
              <em>em aberto</em>
            </span>
            {empresa.criticos > 0 || empresa.vencidos > 0 ? (
              <span className="ct-flags">
                {empresa.criticos > 0 ? (
                  <span className="ct-flag">
                    {empresa.criticos} crítico{empresa.criticos > 1 ? "s" : ""}
                  </span>
                ) : null}
                {empresa.vencidos > 0 ? (
                  <span className="ct-flag late">
                    {empresa.vencidos} com prazo vencido
                  </span>
                ) : null}
              </span>
            ) : null}
          </button>
        </form>
      ))}
    </div>
  );
}

/** Chips de filtro e seletor de empresa. Tudo link: o filtro vive na URL, sem JavaScript. */
export function FilaFiltros({
  contagem,
  filtro,
  empresaId,
  empresas,
}: {
  contagem: Record<FilaFiltro, number>;
  filtro: FilaFiltro;
  empresaId: string | null;
  empresas: { orgId: string; nome: string }[];
}) {
  const href = (novoFiltro: FilaFiltro, novaEmpresa: string | null) => {
    const params = new URLSearchParams();
    if (novoFiltro !== "todos") params.set("filtro", novoFiltro);
    if (novaEmpresa) params.set("empresa", novaEmpresa);
    const texto = params.toString();
    return texto ? `/admin/central/fila?${texto}` : "/admin/central/fila";
  };
  const atual = empresas.find(empresa => empresa.orgId === empresaId);

  return (
    <div className="ct-filters">
      {FILA_FILTROS.map(opcao => (
        <Link
          key={opcao.key}
          href={href(opcao.key, empresaId)}
          className={`ct-chip ${filtro === opcao.key ? "on" : ""}`}
          aria-current={filtro === opcao.key ? "true" : undefined}
        >
          {opcao.label} <b>{contagem[opcao.key]}</b>
        </Link>
      ))}
      <details className="ct-company-select">
        <summary className="ct-chip company">
          <IconBuilding size={16} />
          {atual ? atual.nome : "Todas as empresas"}
          <IconChevronDown />
        </summary>
        <div className="ct-company-menu">
          <Link href={href(filtro, null)} className={empresaId ? "" : "on"}>
            Todas as empresas
          </Link>
          {empresas.map(empresa => (
            <Link
              key={empresa.orgId}
              href={href(filtro, empresa.orgId)}
              className={empresa.orgId === empresaId ? "on" : ""}
            >
              {empresa.nome}
            </Link>
          ))}
        </div>
      </details>
    </div>
  );
}
