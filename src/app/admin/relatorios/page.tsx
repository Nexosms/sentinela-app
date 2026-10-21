import type { Metadata } from "next";
import Link from "next/link";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { isNexoAdmin, getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  MONTHLY_KIND,
  mesPorExtenso,
  monthlyMetricsSchema,
} from "@/lib/admin/relatorioMensalTipos";

export const metadata: Metadata = { title: "Relatórios" };

/**
 * Índice dos relatórios mensais PUBLICADOS da empresa ativa. Duas travas além
 * da RLS: a organização ativa e `is_published` — a Nexo está em toda empresa e
 * vê rascunho por RLS, então só o filtro daqui mostra o painel como o cliente o
 * vê. O rascunho da Nexo vive em /admin/clientes/relatorios.
 */
export default async function Page() {
  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("report_snapshots")
    .select("id, period_start, metrics, published_at")
    .eq("org_id", staff.orgId)
    .eq("kind", MONTHLY_KIND)
    .eq("is_published", true)
    .order("period_start", { ascending: false })
    .limit(60);

  const relatorios = (data ?? []).flatMap(row => {
    const parsed = monthlyMetricsSchema.safeParse(row.metrics);
    return parsed.success ? [{ id: row.id, metrics: parsed.data }] : [];
  });
  const nexo = await isNexoAdmin();

  return (
    <>
      <AdminTopbar eyebrow="INDICADORES" title="Relatórios" />
      <section className="form-card">
        <span className="section-kicker">RELATÓRIO MENSAL</span>
        <h1>O mês do seu canal, em números.</h1>
        <p className="lead">
          Todo mês a Nexo prepara o resumo do canal de denúncias de {staff.orgName}: quanto foi recebido, a
          gravidade, o andamento e os prazos. Só indicadores — nenhum relato individual aparece.
        </p>

        {relatorios.length === 0 ? (
          <div className="placeholder">
            <span>◇</span>
            <small>AINDA NÃO HÁ RELATÓRIO</small>
            <h2>O primeiro relatório sai no início do próximo mês.</h2>
            <p>
              Assim que a equipe Nexo conferir e liberar o relatório do mês, ele aparece aqui, pronto para
              ler e baixar em PDF.
            </p>
          </div>
        ) : (
          <div className="mr-list">
            {relatorios.map(({ id, metrics }) => (
              <Link key={id} className="mr-list-item" href={`/admin/relatorios/mensal/${metrics.mes}`}>
                <b>{metrics.mes.slice(5)}/{metrics.mes.slice(2, 4)}</b>
                <div>
                  <strong>{mesPorExtenso(metrics.mes)}</strong>
                  <small>
                    {metrics.atual.total} {metrics.atual.total === 1 ? "relato recebido" : "relatos recebidos"}
                  </small>
                </div>
                <span>Abrir →</span>
              </Link>
            ))}
          </div>
        )}

        {nexo ? (
          <div className="case-actions">
            <Link className="primary-button portal-link-button" href="/admin/clientes/relatorios">
              Gerar e liberar relatórios (equipe Nexo) <span>→</span>
            </Link>
          </div>
        ) : null}
      </section>
    </>
  );
}
