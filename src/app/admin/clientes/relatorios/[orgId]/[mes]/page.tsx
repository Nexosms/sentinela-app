import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import MonthlyDashboard from "@/components/relatorio/MonthlyDashboard";
import PrintButton from "@/components/relatorio/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { isNexoAdmin } from "@/lib/org/context";
import {
  MONTHLY_KIND,
  isMes,
  limitesDoMes,
  mesPorExtenso,
  monthlyMetricsSchema,
} from "@/lib/admin/relatorioMensalTipos";
import { UUID } from "@/lib/admin/relatorios";

export const metadata: Metadata = { title: "Pré-visualizar relatório mensal" };

/**
 * Pré-visualização para a Nexo conferir o relatório (rascunho ou liberado) de
 * QUALQUER empresa antes de liberar. A RLS deixa o admin da Sentinela ler
 * rascunho; para os demais papéis a consulta volta vazia e a página dá 404.
 */
export default async function Page({ params }: { params: Promise<{ orgId: string; mes: string }> }) {
  const { orgId, mes } = await params;
  if (!UUID.test(orgId) || !isMes(mes)) notFound();
  if (!(await isNexoAdmin())) notFound();

  const supabase = await createClient();
  const { inicio, fim } = limitesDoMes(mes);
  const { data } = await supabase
    .from("report_snapshots")
    .select("metrics, is_published")
    .eq("org_id", orgId)
    .eq("kind", MONTHLY_KIND)
    .eq("period_start", inicio)
    .eq("period_end", fim)
    .maybeSingle();
  if (!data) notFound();

  const metrics = monthlyMetricsSchema.safeParse(data.metrics);
  if (!metrics.success) notFound();

  return (
    <>
      <AdminTopbar eyebrow="NEXO · PRÉ-VISUALIZAÇÃO" title={mesPorExtenso(mes)} />
      <div className="mr-wrap">
        <p className="no-print">
          <Link className="quiet-link" href={`/admin/clientes/relatorios?mes=${mes}`}>
            ← Voltar para a lista
          </Link>
        </p>
        <MonthlyDashboard metrics={metrics.data} rascunho={!data.is_published} acoes={<PrintButton />} />
      </div>
    </>
  );
}
