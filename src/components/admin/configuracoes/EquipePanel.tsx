import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { getStaffContext, getRoleNavOverrides, roleLabel } from "@/lib/org/context";
import { formatDate } from "@/lib/admin/labels";
import {
  MEMBER_STATUS_LABEL,
  ROLE_DESCRIPTION,
  ROLE_ORDER,
  settingsHref,
  type SettingsFilters,
} from "@/lib/admin/configuracoes";
import { CONFIGURABLE_NAV_ITEMS, isNavVisible } from "@/lib/admin/navItems";
import ConviteForm from "./ConviteForm";
import { PapelForm, PermissoesForm, SituacaoForm, type Membro } from "./SettingsControls";

/**
 * Quem tem acesso ao canal, com papel e situação.
 *
 * A regra que esta tela existe para não deixar quebrar: a organização não pode
 * ficar sem NENHUM administrador ativo. Quem recusa de verdade é
 * `alterarPapel`/`alterarSituacaoMembro`, que contam os admins ativos antes de
 * gravar — aqui o aviso só antecipa a recusa para que ninguém descubra o
 * problema depois de clicar.
 */
export default async function EquipePanel({
  filters,
  readOnly = false,
}: {
  filters: SettingsFilters;
  readOnly?: boolean;
}) {
  const staff = await getStaffContext();
  const supabase = await createClient();

  // Sob RLS: `members_read` limita à organização; `profiles_colleagues` só
  // devolve o perfil de quem está ATIVO, então o convidado ainda sem primeiro
  // acesso vem sem `profiles` — e a tela precisa dizer isso em vez de sumir
  // com a linha.
  const { data } = await supabase
    .from("org_members")
    .select(
      "id, user_id, role, status, invited_at, activated_at, profiles!org_members_user_id_fkey(full_name, email)",
    )
    .eq("org_id", staff.orgId)
    .order("invited_at", { ascending: true });

  const membros: Membro[] = (data ?? []).map(row => ({
    id: row.id,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    full_name: row.profiles?.full_name ?? "Convidado (perfil visível só após o primeiro acesso)",
    email: row.profiles?.email ?? "—",
    invited_at: row.invited_at,
    activated_at: row.activated_at,
  }));

  const adminsAtivos = membros.filter(
    membro => membro.role === "admin" && membro.status === "active",
  );
  const emEdicao = filters.membro ? membros.find(membro => membro.id === filters.membro) : undefined;
  const overrides = await getRoleNavOverrides(staff.orgId);

  return (
    <>
      <div className="list-head">
        <span>
          {membros.length} pessoa{membros.length === 1 ? "" : "s"} com vínculo
        </span>
        <small>
          {adminsAtivos.length} administrador{adminsAtivos.length === 1 ? "" : "es"} ativo
          {adminsAtivos.length === 1 ? "" : "s"}
        </small>
      </div>

      <div className="file-list">
        {membros.map(membro => {
          const ehVoce = membro.user_id === staff.userId;
          return (
            <div key={membro.id}>
              <span>
                {membro.status === "active" ? "◉" : membro.status === "invited" ? "◌" : "⊘"}
              </span>
              <b>
                {membro.full_name}
                {ehVoce ? " (você)" : ""}
                <small>
                  {membro.email} · {roleLabel(membro.role)} · {MEMBER_STATUS_LABEL[membro.status]}
                </small>
                <small>
                  {membro.activated_at
                    ? `Acesso desde ${formatDate(membro.activated_at)}`
                    : `Convidado em ${formatDate(membro.invited_at)} — ainda não entrou`}
                </small>
              </b>
              {readOnly ? null : (
                <Link
                  href={settingsHref("equipe", { membro: membro.id })}
                  aria-label={`Gerenciar o acesso de ${membro.full_name}`}
                  title="Gerenciar acesso"
                >
                  ✎
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {adminsAtivos.length === 1 ? (
        <div className="risk-banner">
          <span>!</span>
          <div>
            <strong>A organização tem um único administrador ativo</strong>
            <p>
              Enquanto for assim, esse vínculo não pode ser rebaixado nem suspenso — nem pela
              própria pessoa. Convide (ou promova) um segundo administrador: se essa conta se
              perder, ninguém mais consegue abrir Configurações ou convidar alguém.
            </p>
          </div>
        </div>
      ) : null}

      {emEdicao && !readOnly ? (
        <>
          <div className="privacy-note">
            <b>Gerenciando o acesso de {emEdicao.full_name}</b>
            <p>
              {ROLE_DESCRIPTION[emEdicao.role]} Papel e situação valem a partir do próximo
              carregamento de página da pessoa — a sessão dela não é encerrada na hora.{" "}
              <Link className="quiet-link" href={settingsHref("equipe")}>
                Fechar
              </Link>
            </p>
          </div>
          <PapelForm
            membro={emEdicao}
            ehVoce={emEdicao.user_id === staff.userId}
            ultimoAdmin={
              emEdicao.role === "admin" && emEdicao.status === "active" && adminsAtivos.length === 1
            }
          />
          <SituacaoForm membro={emEdicao} />
        </>
      ) : null}

      {readOnly ? null : (
        <>
          <div className="list-head">
            <span>Convidar alguém</span>
            <small>o acesso ao painel é só por convite</small>
          </div>

          <div className="privacy-note">
            <b>O que acontece ao convidar</b>
            <p>
              O Supabase cria a conta de autenticação e o vínculo entra como{" "}
              <strong>Convidado</strong>. A pessoa abre o link, define a senha e o próprio primeiro
              acesso ativa o vínculo — não é preciso voltar aqui para liberar. Se o link não
              funcionar para ela, você pode liberar o acesso manualmente na linha dela acima.
            </p>
            <p>
              Quem chega vê <strong>denúncias reais</strong>, com relatos de assédio e, conforme o
              papel, pedidos de quebra de sigilo. Convide pelo papel mais estreito que resolve: dá
              para promover depois, e cada mudança fica na trilha de auditoria.
            </p>
          </div>

          <ConviteForm />
        </>
      )}

      <div className="list-head">
        <span>Permissões por cargo</span>
        <small>quais abas do menu admin cada cargo enxerga</small>
      </div>

      <div className="privacy-note">
        <b>Como funciona</b>
        <p>
          Administração sempre enxerga tudo — este painel não decide o acesso dela. Para os outros
          três cargos, desmarque uma aba para escondê-la do menu dessa pessoa. &ldquo;Visão
          geral&rdquo; fica sempre visível: sem ela, quem não tem mais nenhuma aba liberada não
          teria para onde ir ao entrar.
        </p>
      </div>

      {readOnly
        ? ROLE_ORDER.filter(role => role !== "admin").map(role => (
            <div className="review-grid" key={role}>
              <article>
                <small>{roleLabel(role).toUpperCase()}</small>
                <p>
                  {CONFIGURABLE_NAV_ITEMS.filter(item => isNavVisible(role, item, overrides))
                    .map(item => item.label)
                    .join(", ") || "nenhuma aba além de Visão geral"}
                </p>
              </article>
            </div>
          ))
        : ROLE_ORDER.filter(role => role !== "admin").map(role => (
            <PermissoesForm key={role} role={role} overrides={overrides} />
          ))}
    </>
  );
}
