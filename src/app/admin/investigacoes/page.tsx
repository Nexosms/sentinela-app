import type { Metadata } from "next";

import AdminTopbar from "@/components/admin/AdminTopbar";
import InvestigationShell from "@/components/admin/investigacoes/InvestigationShell";
import {
  NovaInvestigacaoForm,
  type Person,
  type ReportOption,
} from "@/components/admin/investigacoes/InvestigationControls";
import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import { UUID, parseInvestigationFilters, type SearchParams } from "@/lib/admin/investigacoes";

export const metadata: Metadata = { title: "Investigações" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = parseInvestigationFilters(params);
  const staff = await getStaffContext();

  // `comite` lê e não escreve — a policy `inv_insert` (migração 037) aceita
  // admin, investigador e triagem. O papel aqui esconde o formulário; quem
  // recusa é a RLS.
  const canOpen =
    staff.role === "admin" || staff.role === "investigador" || staff.role === "triagem";

  // Veio de um botão "Abrir investigação" na tela da denúncia
  // (CaseControls.tsx): pré-seleciona essa denúncia no formulário abaixo.
  const relatoParam = params.relato;
  const relatoId = typeof relatoParam === "string" && UUID.test(relatoParam) ? relatoParam : null;

  const supabase = await createClient();
  // As denúncias vêm sob a RLS da caixa de entrada: só aparece o que a pessoa
  // já poderia abrir em /admin/denuncias.
  const { data: reportRows } = canOpen
    ? await supabase
        .from("reports")
        .select("id, protocol, status")
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: null };
  const { data: memberRows } = canOpen
    ? await supabase
        .from("org_members")
        .select("user_id, profiles!org_members_user_id_fkey(full_name)")
        .eq("status", "active")
    : { data: null };

  const reports: ReportOption[] = (reportRows ?? []).map(report => ({
    id: report.id,
    protocol: report.protocol,
    status: report.status,
  }));

  // A pré-seleção pode apontar para uma denúncia fora dos 200 relatos mais
  // recentes já buscados acima — sem isto, o `<select>` receberia um id
  // pré-selecionado que não está entre as opções.
  if (canOpen && relatoId && !reports.some(report => report.id === relatoId)) {
    const { data: extra } = await supabase
      .from("reports")
      .select("id, protocol, status")
      .eq("id", relatoId)
      .maybeSingle();
    if (extra) reports.unshift({ id: extra.id, protocol: extra.protocol, status: extra.status });
  }

  const people: Person[] = (memberRows ?? []).map(row => ({
    user_id: row.user_id,
    name: row.profiles?.full_name ?? "Membro sem nome",
  }));

  return (
    <>
      <AdminTopbar eyebrow="APURAÇÃO" title="Investigações" />
      <InvestigationShell
        filters={filters}
        detail={
          <section className="case-detail">
            <div className="placeholder">
              <span>◇</span>
              <small>APURAÇÃO</small>
              <h2>Selecione uma investigação</h2>
              <p>
                Escolha uma apuração na lista à esquerda para ver o plano, a equipe com as
                declarações de impedimento, as denúncias vinculadas, as entrevistas e os achados.
              </p>
            </div>
            {canOpen ? (
              <NovaInvestigacaoForm
                reports={reports}
                people={people}
                selfId={staff.userId}
                preselectedReportId={relatoId ?? undefined}
              />
            ) : null}
          </section>
        }
      />
    </>
  );
}
