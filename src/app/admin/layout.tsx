import type { Metadata } from "next";
import type { ReactNode } from "react";

import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminShellFrame from "@/components/admin/shell/AdminShellFrame";
import ContextBar from "@/components/admin/shell/ContextBar";
import { contarFilaDoDia, listarEmpresasDaCentral } from "@/lib/admin/central";
import { publicEnv } from "@/lib/env";
import {
  getRoleNavOverrides,
  getStaffContext,
  isNexoAdmin,
  listMyOrganizations,
} from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";

import "./admin.css";

// Depende da identidade por requisição.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Sentinela" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getStaffContext();
  const supabase = await createClient();

  // Com o Sentinela ativo a lista de denúncias agrega todas as empresas, então o número também; em
  // qualquer outra empresa conta só a dela (antes contava as de todas, mesmo dentro de um cliente).
  // Contagem sob RLS: o investigador só conta o que ele pode ver.
  const agregando = staff.orgSlug === publicEnv.defaultOrgSlug;
  let pendentes = supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "em_triagem");
  if (!agregando) pendentes = pendentes.eq("org_id", staff.orgId);

  const [{ count }, navOverrides, myOrgs, nexoAdmin, empresasCentral, filaCount] = await Promise.all([
    pendentes,
    getRoleNavOverrides(staff.orgId),
    listMyOrganizations(),
    isNexoAdmin(),
    listarEmpresasDaCentral(),
    contarFilaDoDia(),
  ]);

  const hasCentral = empresasCentral.length > 1;

  return (
    <AdminShellFrame
      sidebar={
        <AdminSidebar
          orgId={staff.orgId}
          orgName={staff.orgName}
          fullName={staff.fullName}
          email={staff.email}
          role={staff.role}
          pendingCount={count ?? 0}
          filaCount={filaCount}
          totalEmpresas={empresasCentral.length}
          hasCentral={hasCentral}
          navOverrides={navOverrides}
          myOrgs={myOrgs}
          nexoAdmin={nexoAdmin}
        />
      }
      contextBar={
        hasCentral ? <ContextBar orgName={staff.orgName} equipeNexo={nexoAdmin} /> : null
      }
    >
      {children}
    </AdminShellFrame>
  );
}
