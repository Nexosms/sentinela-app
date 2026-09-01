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
import { parseInvestigationFilters, type SearchParams } from "@/lib/admin/investigacoes";

export const metadata: Metadata = { title: "Investigações" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseInvestigationFilters(await searchParams);
  const staff = await getStaffContext();

  // `triagem` e `comite` leem e não escrevem — a policy `inv_insert` só aceita
  // admin e investigador. O papel aqui esconde o formulário; quem recusa é ela.
  const canOpen = staff.role === "admin" || staff.role === "investigador";

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
              <NovaInvestigacaoForm reports={reports} people={people} selfId={staff.userId} />
            ) : null}
          </section>
        }
      />
    </>
  );
}
