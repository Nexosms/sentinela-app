import type { Metadata } from "next";
import Link from "next/link";

import AdminTopbar from "@/components/admin/AdminTopbar";
import PublicarForm from "@/components/admin/portal/PublicarForm";
import { formatDocumento } from "@/lib/admin/configuracoes";
import { todayInSaoPaulo } from "@/lib/admin/labels";
import { publicEnv } from "@/lib/env";
import { isNexoAdmin, listMyOrganizations } from "@/lib/org/context";

export const metadata: Metadata = { title: "Publicar para várias empresas" };

/**
 * Publicar o mesmo material (ou uma pasta de campanha) para várias empresas de
 * uma vez. Só a equipe Nexo. A lista vem de `listMyOrganizations()`: a Nexo está
 * em toda empresa-cliente, então ela traz todas. Fora a própria Sentinela e as
 * desativadas, que não têm portal para receber nada.
 */
export default async function PublicarPage() {
  if (!(await isNexoAdmin())) {
    return (
      <>
        <AdminTopbar eyebrow="NEXO" title="Publicar para várias empresas" />
        <div className="placeholder">
          <span>⚑</span>
          <small>ACESSO RESTRITO À EQUIPE NEXO</small>
          <h2>Publicar para várias empresas</h2>
        </div>
      </>
    );
  }

  const empresas = (await listMyOrganizations())
    .filter(org => org.isActive && org.slug !== publicEnv.defaultOrgSlug)
    .sort((a, b) => a.tradeName.localeCompare(b.tradeName, "pt-BR", { sensitivity: "base" }))
    .map(org => ({ id: org.orgId, name: org.tradeName, doc: formatDocumento(org.cnpj) }));

  const [ano, mes] = todayInSaoPaulo().split("-");

  return (
    <>
      <AdminTopbar eyebrow="NEXO" title="Publicar para várias empresas" />
      <section className="portal-page">
        <Link className="portal-back" href="/admin/clientes">
          <span aria-hidden="true">←</span> Voltar para Clientes
        </Link>
        <p className="lead">
          O arquivo sobe uma vez e cada empresa marcada recebe a sua própria cópia. Depois de publicado,
          cada cópia é editada ou apagada separadamente, dentro do portal de cada empresa.
        </p>
        <PublicarForm empresas={empresas} defaultMonth={String(Number(mes))} defaultYear={ano} />
      </section>
    </>
  );
}
