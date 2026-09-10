import type { Metadata } from "next";

import AdminTopbar from "@/components/admin/AdminTopbar";
import ClienteForm from "@/components/admin/clientes/ClienteForm";
import { isNexoAdmin, listMyOrganizations, roleLabel } from "@/lib/org/context";

export const metadata: Metadata = { title: "Clientes" };

/**
 * Só para a equipe Nexo (`isNexoAdmin()`) — cadastro de empresa-cliente nova.
 * Cada empresa é a sua própria organização; ver `criarEmpresaCliente` em
 * `./actions.ts` para o porquê do service role aqui.
 */
export default async function ClientesPage() {
  if (!(await isNexoAdmin())) {
    return (
      <>
        <AdminTopbar eyebrow="NEXO" title="Clientes" />
        <div className="placeholder">
          <span>⚑</span>
          <small>ACESSO RESTRITO À EQUIPE NEXO</small>
          <h2>Clientes</h2>
          <p>O cadastro de empresas-cliente é exclusivo de quem administra a organização Sentinela.</p>
        </div>
      </>
    );
  }

  const organizacoes = await listMyOrganizations();

  return (
    <>
      <AdminTopbar eyebrow="NEXO" title="Clientes" />
      <section className="form-card">
        <span className="section-kicker">EMPRESAS-CLIENTE</span>
        <h1>Cada empresa, sua organização.</h1>
        <p className="lead">
          Cada empresa-cliente tem seus próprios dados, equipe e link de relato
          (<code>/relato/&lt;slug&gt;</code>), isolados das demais.
        </p>

        <div className="list-head">
          <span>
            {organizacoes.length} organização{organizacoes.length === 1 ? "" : "ões"} sob sua
            administração
          </span>
        </div>
        <div className="file-list">
          {organizacoes.map(org => (
            <div key={org.orgId}>
              <b>
                {org.tradeName}
                <small>
                  /relato/{org.slug} · {roleLabel(org.role)}
                </small>
              </b>
            </div>
          ))}
        </div>

        <div className="list-head">
          <span>Cadastrar empresa nova</span>
        </div>
        <ClienteForm />
      </section>
    </>
  );
}
