import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { CentralKpis, CompanyGrid, QueueTable, SigiloNota } from "@/components/admin/central/CentralParts";
import { IconArrowRight, IconChevronRight } from "@/components/admin/shell/AdminIcons";
import { carregarCentral, temCentral } from "@/lib/admin/central";
import { saudacao } from "@/lib/admin/saudacao";
import { getStaffContext } from "@/lib/org/context";

export const metadata: Metadata = { title: "Central" };

/** Quantas linhas da fila aparecem aqui; a fila inteira tem página própria. */
const NA_CENTRAL = 8;

export default async function CentralPage() {
  // Só faz sentido para quem tem acesso a mais de uma empresa.
  if (!(await temCentral())) redirect("/admin");

  const [staff, central] = await Promise.all([getStaffContext(), carregarCentral()]);
  const { fila, empresas, kpis, agora } = central;

  return (
    <>
      <AdminTopbar eyebrow="CENTRAL" title="Visão consolidada" />
      <div className="ad-wrap">
        <div className="ad-hero">
          <div>
            <h2>
              {saudacao(agora)}, {staff.fullName.split(" ")[0]}.{" "}
              <b>
                {fila.length > 0
                  ? `${fila.length} ${fila.length === 1 ? "item pede" : "itens pedem"} atenção hoje.`
                  : "Nada pede atenção agora."}
              </b>
            </h2>
            <p>
              <i aria-hidden="true" />
              Em {kpis.empresasComItens} de {kpis.empresasAtivas} empresas · só indicadores: nenhum relato
              é aberto aqui
            </p>
          </div>
          <Link className="ad-btn" href="/admin/central/fila">
            Abrir fila do dia
            <span className="ad-btn-arrow" aria-hidden="true">
              <IconArrowRight />
            </span>
          </Link>
        </div>

        <CentralKpis kpis={kpis} />

        <section className="ad-card" style={{ marginTop: 16 }}>
          <div className="ad-card-head">
            <div>
              <small>CONFERÊNCIA DIÁRIA</small>
              <h3>Fila do dia</h3>
            </div>
            <Link className="ad-pill" href="/admin/central/fila">
              Ver fila completa
              <IconChevronRight />
            </Link>
          </div>
          <QueueTable itens={fila.slice(0, NA_CENTRAL)} agora={agora} />
          {central.truncado ? (
            <p className="ct-trunc">
              Há relatos demais para listar de uma vez: a Central mostra os mais recentes. Entre na
              empresa para ver o restante.
            </p>
          ) : null}
          <SigiloNota />
        </section>

        <section className="ad-card">
          <div className="ad-card-head">
            <div>
              <small>EMPRESAS</small>
              <h3>Quem pede mais atenção</h3>
            </div>
            <Link className="ad-pill" href="/admin/central/empresas">
              Ver todas
              <IconChevronRight />
            </Link>
          </div>
          <CompanyGrid empresas={empresas.slice(0, 6)} agora={agora} />
        </section>
      </div>
    </>
  );
}
