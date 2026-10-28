import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import { CompanyGrid } from "@/components/admin/central/CentralParts";
import { carregarCentral, temCentral } from "@/lib/admin/central";

export const metadata: Metadata = { title: "Empresas" };

export default async function EmpresasPage() {
  if (!(await temCentral())) redirect("/admin");

  const { empresas, agora } = await carregarCentral();

  return (
    <>
      <AdminTopbar eyebrow="CENTRAL" title="Empresas" />
      <div className="ad-wrap">
        <section className="ad-card">
          <div className="ad-card-head">
            <div>
              <small>EMPRESAS</small>
              <h3>
                {empresas.length} {empresas.length === 1 ? "empresa" : "empresas"} no seu acesso
              </h3>
            </div>
          </div>
          <CompanyGrid empresas={empresas} agora={agora} />
        </section>
      </div>
    </>
  );
}
