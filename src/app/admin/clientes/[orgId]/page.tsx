import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AdminTopbar from "@/components/admin/AdminTopbar";
import EditarClienteForm from "@/components/admin/clientes/EditarClienteForm";
import ConvidarContatoForm from "@/components/admin/clientes/ConvidarContatoForm";
import AlternarEmpresaForm from "@/components/admin/clientes/AlternarEmpresaForm";
import { MEMBER_STATUS_LABEL } from "@/lib/admin/configuracoes";
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
    .select("id, slug, trade_name, legal_name, cnpj, address, is_active")
    .eq("id", orgId)
    .maybeSingle();

  if (!org) notFound();

  // Contatos já cadastrados (papel Comitê) — decide se mostra "convidar" ou "convidar mais um".
  const { data: contatos } = await supabase
    .from("org_members")
    .select("id, status, profiles!org_members_user_id_fkey(full_name, email)")
    .eq("org_id", orgId)
    .eq("role", "comite")
    .order("invited_at", { ascending: true });

  return (
    <>
      <AdminTopbar eyebrow="NEXO" title={org.trade_name} />
      <section className="form-card">
        <span className="section-kicker">EMPRESA-CLIENTE</span>
        <h1>{org.trade_name}</h1>

        {org.is_active ? null : (
          <div className="risk-banner">
            <span>!</span>
            <div>
              <strong>Empresa desativada</strong>
              <p>
                O link do relato abaixo não funciona mais para quem tenta abrir, e ela some do
                seletor de organização de quem trabalha nela. Reative para voltar ao normal.
              </p>
            </div>
          </div>
        )}

        <div className="list-head">
          <span>Situação</span>
          <AlternarEmpresaForm orgId={org.id} tradeName={org.trade_name} isActive={org.is_active} />
        </div>

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
          org={{
            id: org.id,
            tradeName: org.trade_name,
            legalName: org.legal_name,
            cnpj: org.cnpj,
            address: org.address,
          }}
        />

        <div className="list-head">
          <span>Contato do cliente</span>
        </div>
        {contatos && contatos.length > 0 ? (
          <div className="file-list">
            {contatos.map(contato => (
              <div key={contato.id}>
                <b>
                  {contato.profiles?.full_name ?? "Convidado (perfil visível só após o primeiro acesso)"}
                  <small>
                    {contato.profiles?.email ?? "—"} · {MEMBER_STATUS_LABEL[contato.status]}
                  </small>
                </b>
              </div>
            ))}
          </div>
        ) : (
          <p className="lead">Nenhum contato cadastrado ainda.</p>
        )}
        <ConvidarContatoForm orgId={org.id} />

        <div className="list-head">
          <span>Equipe e permissões</span>
        </div>
        <p className="lead">
          Para ajustar papel, situação ou o que cada cargo enxerga nesta organização, entre nela e
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
