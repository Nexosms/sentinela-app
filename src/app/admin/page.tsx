import type { Metadata } from "next";

import AdminTopbar from "@/components/admin/AdminTopbar";
import OverviewView, { type OverviewData } from "@/components/admin/overview/OverviewView";
import { carregarContagensComite } from "@/lib/admin/comiteContagens";
import { STATUS_ORDER, type ReportStatus } from "@/lib/admin/labels";
import { NAV_ITEMS, isNavVisible } from "@/lib/admin/navItems";
import { saudacao } from "@/lib/admin/saudacao";
import { getRoleNavOverrides, getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Visão geral" };

const DENUNCIAS = NAV_ITEMS.find(item => item.key === "denuncias")!;

const SEM_STATUS = Object.fromEntries(STATUS_ORDER.map(status => [status, null])) as Record<
  ReportStatus,
  number | null
>;

export default async function AdminOverview() {
  const staff = await getStaffContext();

  const base = {
    saudacao: saudacao(),
    primeiroNome: staff.fullName.split(" ")[0],
    orgName: staff.orgName,
  };

  // Comitê: SÓ contagens, nunca relatos. Ele não tem acesso de leitura a `reports` (a RLS não o
  // admite), então contar direto daria zero. As contagens vêm de uma função do banco que devolve
  // apenas números, protegidos quando o grupo é pequeno. Sem a função, mostra "indisponível".
  if (staff.role === "comite") {
    const contagens = await carregarContagensComite(staff.orgId);
    const dados: OverviewData = contagens
      ? {
          ...base,
          abertos: contagens.abertos,
          triagem: contagens.por_status.em_triagem,
          criticos: contagens.criticos,
          total: contagens.total,
          porStatus: {
            em_triagem: contagens.por_status.em_triagem,
            em_apuracao: contagens.por_status.em_apuracao,
            aguardando_informacao: contagens.por_status.aguardando_informacao,
            concluida: contagens.por_status.concluida,
            arquivada: contagens.por_status.arquivada,
          },
          recentes: [],
          podeVerDenuncias: false,
          modo: "comite",
          minimo: contagens.minimo,
        }
      : {
          ...base,
          abertos: null,
          triagem: null,
          criticos: null,
          total: null,
          porStatus: SEM_STATUS,
          recentes: [],
          podeVerDenuncias: false,
          modo: "comite",
          indisponivel: true,
        };
    return (
      <>
        <AdminTopbar eyebrow="VISÃO OPERACIONAL" title="Visão geral" />
        <OverviewView dados={dados} />
      </>
    );
  }

  const supabase = await createClient();

  // Escopo explícito pela organização ativa: a RLS sozinha autoriza por TODO vínculo ativo da pessoa
  // (não só o "ativo" no seletor), e desde que a equipe da Sentinela ganhou vínculo automático em
  // todo cliente, sem este filtro os números aqui misturariam todas as empresas.
  const contar = (status?: ReportStatus) => {
    let consulta = supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("org_id", staff.orgId);
    if (status) consulta = consulta.eq("status", status);
    return consulta;
  };

  const [criticos, total, ...porStatusBruto] = await Promise.all([
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("org_id", staff.orgId)
      .eq("risk", "critico")
      .not("status", "in", "(concluida,arquivada)"),
    contar(),
    ...STATUS_ORDER.map(status => contar(status)),
  ]);

  const porStatus = Object.fromEntries(
    STATUS_ORDER.map((status, i) => [status, porStatusBruto[i].count ?? 0]),
  ) as Record<ReportStatus, number>;

  // "Abertos" = tudo menos concluída e arquivada, igual a antes.
  const abertos = porStatus.em_triagem + porStatus.em_apuracao + porStatus.aguardando_informacao;

  const { data: recentes } = await supabase
    .from("reports")
    .select("id, protocol, status, risk, created_at")
    .eq("org_id", staff.orgId)
    .order("created_at", { ascending: false })
    .limit(5);

  // O atalho e os links levam à caixa de entrada: só para quem a vê na grade de permissões.
  const podeVerDenuncias = isNavVisible(staff.role, DENUNCIAS, await getRoleNavOverrides(staff.orgId));

  return (
    <>
      <AdminTopbar eyebrow="VISÃO OPERACIONAL" title="Visão geral" />
      <OverviewView
        dados={{
          ...base,
          abertos,
          triagem: porStatus.em_triagem,
          criticos: criticos.count ?? 0,
          total: total.count ?? 0,
          porStatus,
          recentes: (recentes ?? []).map(item => ({
            id: item.id,
            protocol: item.protocol,
            status: item.status,
            risk: item.risk,
            createdAt: item.created_at,
          })),
          podeVerDenuncias,
        }}
      />
    </>
  );
}
