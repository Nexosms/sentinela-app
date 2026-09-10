import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext, getRoleNavOverrides, listMyOrganizations, isNexoAdmin } from "@/lib/org/context";

// Depende da identidade por requisição.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Painel", template: "%s | Painel Sentinela" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const staff = await getStaffContext();
  const supabase = await createClient();

  // Contagem sob RLS: o investigador só conta o que ele pode ver.
  const { count } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "em_triagem");

  const [navOverrides, myOrgs, nexoAdmin] = await Promise.all([
    getRoleNavOverrides(staff.orgId),
    listMyOrganizations(),
    isNexoAdmin(),
  ]);

  return (
    <main className="admin-shell">
      <AdminSidebar
        orgId={staff.orgId}
        orgName={staff.orgName}
        fullName={staff.fullName}
        email={staff.email}
        role={staff.role}
        pendingCount={count ?? 0}
        navOverrides={navOverrides}
        myOrgs={myOrgs}
        nexoAdmin={nexoAdmin}
      />
      <section className="admin-main">{children}</section>
    </main>
  );
}
