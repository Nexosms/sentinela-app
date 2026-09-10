import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import EditarClienteForm from "@/components/admin/clientes/EditarClienteForm";
import { isNexoAdmin } from "@/lib/org/context";
import { trocarOrganizacaoAtiva } from "@/lib/org/actions";
import { createClient } from "@/lib/supabase/server";
import { relatoUrl } from "@/lib/admin/clientes";

export const metadata: Metadata = { title: "Cliente" };

/**
 * Detalhe/edição de uma empresa-cliente. Busca com o cliente de sessão sob
 * RLS — `org_read` já autoriza porque a Nexo é `admin` daquela organização
 * (nenhum service role aqui: só o cadastro inicial precisava dele).
 */
export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  if (!(await isNexoAdmin())) {
    return (
      <>
        <AdminTopbar eyebrow="NEXO" title="Cliente" />
        <div className="placeholder">
          <span>⚑</span>
          <small>ACESSO RESTRITO À EQUIPE NEXO</small>
          <h2>Cliente</h2>
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id, slug, trade_name, legal_name, cnpj")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) notFound();

  return (
    <>
      <AdminTopbar eyebrow="NEXO" title={org.trade_name} />
      <section className="form-card">
        <span className="section-kicker">EMPRESA-CLIENTE</span>
        <h1>{org.trade_name}</h1>

        <div className="privacy-note">
          <b>Link do relato — dê este aos colaboradores</b>
          <p>Não expira e pode ser usado por qualquer pessoa, quantas vezes for preciso.</p>
          <label className="wide-field">
            Link
            <textarea readOnly rows={2} value={relatoUrl(org.slug)} aria-label="Link do relato" />
          </label>
        </div>

        <div className="list-head">
          <span>Dados cadastrais</span>
        </div>
        <EditarClienteForm
          org={{ id: org.id, tradeName: org.trade_name, legalName: org.legal_name, cnpj: org.cnpj }}
        />

        <div className="list-head">
          <span>Equipe e permissões</span>
        </div>
        <p className="lead">
          Para convidar pessoas ou ajustar o que cada papel enxerga nesta organização, entre nela e
          use Configurações → Time e permissões.
        </p>
        <form action={trocarOrganizacaoAtiva}>
          <input type="hidden" name="orgId" value={org.id} />
          <div className="case-actions">
            <button className="primary-button" type="submit">
              Entrar em {org.slug} <span>→</span>
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
