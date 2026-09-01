import type { ReactNode } from "react";
import Link from "next/link";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { formatDateTime } from "@/lib/admin/labels";
import { listUnits } from "@/lib/admin/relatorios-dados";
import {
  REPORT_PATH,
  exportHref,
  formatMonth,
  monthOptions,
  periodLabel,
  printHref,
  type ReportFilters,
  type ReportMeta,
} from "@/lib/admin/relatorios";

/**
 * Moldura dos sete relatórios: cabeçalho, filtro de período e unidade, ações
 * (exportar, imprimir) e o cabeçalho do documento impresso.
 *
 * Todo o estado mora na querystring, então o filtro é um `<form method="get">`
 * puro e a página inteira continua Server Component — nada de JavaScript para
 * escolher um mês.
 *
 * `?print=1` não é um `className` a mais: a barra de filtros e a de ações não
 * são renderizadas. O `@media print` de `globals.css` cuida do resto (esconde a
 * barra lateral, tira sombras, impede que um painel se parta entre páginas),
 * para que imprimir a versão normal com Ctrl+P também funcione.
 */
export default async function ReportShell({
  meta,
  filters,
  orgName,
  unitName,
  children,
}: {
  meta: ReportMeta;
  filters: ReportFilters;
  orgName: string;
  unitName: string | null;
  children: ReactNode;
}) {
  const meses = monthOptions();

  const cabecalhoImpresso = (
    <div className="report-print-head">
      <small>{meta.eyebrow}</small>
      <h1>{meta.title}</h1>
      <p>
        {orgName} · {periodLabel(filters)} · {unitName ?? "Todas as unidades"}
      </p>
      <span>
        Gerado em {formatDateTime(new Date().toISOString())} · dados agregados, sem identificação de
        quem relatou
      </span>
    </div>
  );

  if (filters.print) {
    return (
      <div className="dashboard">
        {cabecalhoImpresso}
        {children}
      </div>
    );
  }

  const units = await listUnits();

  return (
    <>
      <AdminTopbar eyebrow={meta.eyebrow} title={meta.title} />
      <div className="dashboard">
        {cabecalhoImpresso}

        <div className="dash-heading">
          <div>
            <p>{meta.question}</p>
            <span>
              {orgName} · {periodLabel(filters)} · {unitName ?? "Todas as unidades"}
            </span>
          </div>
        </div>

        {/* Filtros sem JavaScript: GET puro. */}
        <form className="inbox-tools report-tools" method="get">
          <div className="searchbox">
            <label htmlFor="rel-de">De</label>
            <select id="rel-de" name="de" defaultValue={filters.de}>
              {meses.map(mes => (
                <option key={mes} value={mes}>
                  {formatMonth(mes)}
                </option>
              ))}
            </select>
            <label htmlFor="rel-ate">até</label>
            <select id="rel-ate" name="ate" defaultValue={filters.ate}>
              {meses.map(mes => (
                <option key={mes} value={mes}>
                  {formatMonth(mes)}
                </option>
              ))}
            </select>
          </div>
          <div className="searchbox">
            <select
              name="unidade"
              defaultValue={filters.unidade}
              aria-label="Filtrar por unidade"
            >
              <option value="">Todas as unidades</option>
              {units.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">Aplicar</button>
        </form>

        <div className="inbox-tools report-actions">
          <Link href={REPORT_PATH}>← Todos os relatórios</Link>
          <Link href={printHref(meta.slug, filters)} target="_blank" rel="noopener">
            Versão para impressão
          </Link>
          {/*
            Âncora, não fetch: o CSV vem por rota GET que grava `record_export`
            antes de responder. Sem trilha, sem arquivo.
          */}
          <a className="primary-button" href={exportHref(meta.slug, filters)}>
            Exportar CSV
          </a>
        </div>

        {children}
      </div>
    </>
  );
}
