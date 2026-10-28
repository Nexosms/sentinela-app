import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { FilaFiltros, QueueTable, SigiloNota } from "@/components/admin/central/CentralParts";
import { carregarCentral, temCentral } from "@/lib/admin/central";
import {
  FILA_FILTROS,
  casaComFiltro,
  contarPorFiltro,
  type FilaFiltro,
} from "@/lib/admin/centralFila";

export const metadata: Metadata = { title: "Fila do dia" };

/** Teto de linhas na tela: a fila é para conferir, e filtrar por empresa ou situação encurta. */
const LIMITE_LINHAS = 200;

type Params = { filtro?: string; empresa?: string };

export default async function FilaPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await temCentral())) redirect("/admin");

  const { filtro: filtroBruto, empresa } = await searchParams;
  const filtro: FilaFiltro = FILA_FILTROS.some(opcao => opcao.key === filtroBruto)
    ? (filtroBruto as FilaFiltro)
    : "todos";

  const central = await carregarCentral();
  // Empresa só vale se for uma das que a Central lista; qualquer outro valor é ignorado.
  const empresaId = central.empresas.some(item => item.orgId === empresa) ? (empresa ?? null) : null;

  const daEmpresa = empresaId ? central.fila.filter(item => item.orgId === empresaId) : central.fila;
  const contagem = contarPorFiltro(daEmpresa, central.agora);
  const visiveis = daEmpresa.filter(item => casaComFiltro(item, filtro, central.agora));
  const mostrados = visiveis.slice(0, LIMITE_LINHAS);

  return (
    <>
      <AdminTopbar eyebrow="CENTRAL" title="Fila do dia" />
      <div className="ad-wrap">
        <section className="ad-card">
          <div className="ad-card-head">
            <div>
              <small>CONFERÊNCIA DIÁRIA</small>
              <h3>
                {visiveis.length} {visiveis.length === 1 ? "relato" : "relatos"} para conferir
              </h3>
            </div>
          </div>
          <FilaFiltros
            contagem={contagem}
            filtro={filtro}
            empresaId={empresaId}
            empresas={[...central.empresas]
              .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }))
              .map(item => ({ orgId: item.orgId, nome: item.nome }))}
          />
          <QueueTable itens={mostrados} agora={central.agora} />
          {visiveis.length > LIMITE_LINHAS ? (
            <p className="ct-trunc">
              Mostrando {LIMITE_LINHAS} de {visiveis.length}. Use os filtros ou escolha uma empresa para
              ver o restante.
            </p>
          ) : null}
          {central.truncado ? (
            <p className="ct-trunc">
              Há relatos demais para listar de uma vez: a Central mostra os mais recentes. Entre na
              empresa para ver o restante.
            </p>
          ) : null}
          <SigiloNota />
        </section>
      </div>
    </>
  );
}
