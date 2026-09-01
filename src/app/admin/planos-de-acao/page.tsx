import type { Metadata } from "next";

import AdminTopbar from "@/components/admin/AdminTopbar";
import PlanShell from "@/components/admin/planos/PlanShell";
import {
  NovoPlanoForm,
  type OrigemGroup,
  type Person,
} from "@/components/admin/planos/PlanControls";
import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  RISK_SOURCE_LABEL,
  encodeOrigem,
  parsePlanFilters,
  type SearchParams,
} from "@/lib/admin/planos";

export const metadata: Metadata = { title: "Planos de ação" };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parsePlanFilters(await searchParams);
  const staff = await getStaffContext();

  // `triagem` e `comite` leem e não escrevem — a policy `plans_insert` só
  // aceita admin e investigador. O papel aqui esconde o formulário; quem recusa
  // é ela.
  const canOpen = staff.role === "admin" || staff.role === "investigador";

  const supabase = await createClient();
  // Denúncias e investigações vêm sob a RLS de cada módulo: só aparece o que a
  // pessoa já poderia abrir lá.
  const [{ data: reportRows }, { data: investigationRows }, { data: memberRows }] = canOpen
    ? await Promise.all([
        supabase
          .from("reports")
          .select("id, protocol")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("investigations")
          .select("id, code, scope")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase
          .from("org_members")
          .select("user_id, profiles!org_members_user_id_fkey(full_name)")
          .eq("status", "active"),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const origens: OrigemGroup[] = [
    {
      label: "Denúncia recebida",
      options: (reportRows ?? []).map(report => ({
        value: encodeOrigem("denuncia", report.id),
        label: report.protocol,
      })),
    },
    {
      label: "Investigação",
      options: (investigationRows ?? []).map(investigation => ({
        value: encodeOrigem("investigacao", investigation.id),
        label: `${investigation.code} · ${investigation.scope?.slice(0, 60) ?? "sem escopo"}`,
      })),
    },
    {
      label: "Sem registro vinculado",
      options: [
        { value: encodeOrigem("denuncia", null), label: "Denúncia (sem vincular o protocolo)" },
        { value: encodeOrigem("investigacao", null), label: "Investigação (sem vincular)" },
        {
          value: encodeOrigem("inventario_riscos", null),
          label: RISK_SOURCE_LABEL.inventario_riscos,
        },
        { value: encodeOrigem("auditoria", null), label: RISK_SOURCE_LABEL.auditoria },
        { value: encodeOrigem("cipa", null), label: RISK_SOURCE_LABEL.cipa },
        { value: encodeOrigem("outro", null), label: RISK_SOURCE_LABEL.outro },
      ],
    },
  ];

  const people: Person[] = (memberRows ?? []).map(row => ({
    user_id: row.user_id,
    name: row.profiles?.full_name ?? "Membro sem nome",
  }));

  return (
    <>
      <AdminTopbar eyebrow="PREVENÇÃO E CONTROLE" title="Planos de ação" />
      <PlanShell
        filters={filters}
        detail={
          <section className="case-detail">
            <div className="placeholder">
              <span>◈</span>
              <small>PREVENÇÃO E CONTROLE</small>
              <h2>Selecione um plano de ação</h2>
              <p>
                Escolha um plano na lista à esquerda para ver a origem do risco, as medidas de
                prevenção e controle com o fator de risco que cada uma trata, e a verificação de
                eficácia.
              </p>
            </div>
            {canOpen ? (
              <NovoPlanoForm origens={origens} people={people} selfId={staff.userId} />
            ) : null}
          </section>
        }
      />
    </>
  );
}
