import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import MonthlyDashboard from "@/components/relatorio/MonthlyDashboard";
import PrintButton from "@/components/relatorio/PrintButton";
import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  MONTHLY_KIND,
  isMes,
  limitesDoMes,
  mesPorExtenso,
  monthlyMetricsSchema,
} from "@/lib/admin/relatorioMensalTipos";

export const metadata: Metadata = { title: "Relatório mensal" };

/**
 * O dashboard do mês para o cliente. Lê o relatório JÁ publicado e congelado em
 * `report_snapshots` — nunca recalcula: o Comitê não enxerga `reports` pela RLS
 * e os números precisam ser os mesmos para todos que abrem. Trava dupla além da
 * RLS: organização ativa e `is_published`.
 */
export default async function Page({ params }: { params: Promise<{ mes: string }> }) {
  const { mes } = await params;
  if (!isMes(mes)) notFound();

  const staff = await getStaffContext();
  const supabase = await createClient();
  const { inicio, fim } = limitesDoMes(mes);

  const { data } = await supabase
    .from("report_snapshots")
    .select("metrics")
    .eq("org_id", staff.orgId)
    .eq("kind", MONTHLY_KIND)
    .eq("period_start", inicio)
    .eq("period_end", fim)
    .eq("is_published", true)
    .maybeSingle();
  if (!data) notFound();

  const metrics = monthlyMetricsSchema.safeParse(data.metrics);
  if (!metrics.success) {
    console.error("[relatório mensal] formato inválido em %s/%s", staff.orgId, mes);
    notFound();
  }

  return (
    <>
      <AdminTopbar eyebrow="RELATÓRIO MENSAL" title={mesPorExtenso(mes)} />
      <div className="mr-wrap">
        <p className="no-print">
          <Link className="quiet-link" href="/admin/relatorios">
            ← Voltar para os relatórios
          </Link>
        </p>
        <MonthlyDashboard metrics={metrics.data} acoes={<PrintButton />} />
      </div>
    </>
  );
}
