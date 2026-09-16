import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { publicEnv } from "@/lib/env";

export type ProvisionedUser = {
  userId: string;
  inviteUrl: string | null;
  emailSent: boolean;
};

/**
 * Monta o link a partir do `token_hash`, apontando direto para `/convite` no
 * NOSSO domínio — em vez de `properties.action_link` (a própria URL de
 * verificação do Supabase, em `*.supabase.co`).
 *
 * Motivo: `action_link` consome o token na primeira requisição GET, sem
 * distinguir um clique de verdade de uma prévia automática. WhatsApp,
 * Telegram e Slack buscam esse link para montar a prévia da mensagem assim
 * que ela é enviada/colada — e isso já gasta o token de uso único antes de
 * qualquer pessoa clicar (sintoma: "Email link is invalid or has expired"
 * em TODO link, mesmo recém-gerado). `ConviteClient.tsx` já sabe processar
 * `?token_hash=&type=` chamando `verifyOtp` no cliente — como isso só roda
 * dentro do JavaScript da página (nenhum rastreador de prévia executa React),
 * uma prévia automática só busca HTML estático e nunca toca no token.
 */
function ownInviteLink(properties: { hashed_token: string; verification_type: string }): string {
  return `${publicEnv.siteUrl}/convite?token_hash=${properties.hashed_token}&type=${properties.verification_type}`;
}

/**
 * Garante uma conta de autenticação para `email` e devolve um link utilizável
 * — convite (conta nova) ou recuperação (conta já existente: convite
 * anterior, ou vínculo com outra organização). Extraído de
 * `api/admin/invites/route.ts` para ser reaproveitado por
 * `admin/clientes/actions.ts` (que convida o primeiro contato de uma
 * organização recém-criada).
 *
 * ── ARMADILHA REGISTRADA NO README: nunca criar usuário por SQL ─────────────
 * Um `insert into auth.users (...)` deixa colunas de token NULL, e o GoTrue
 * (escrito em Go) quebra o login inteiro do projeto ao dar scan nelas. Esta
 * função só toca em auth pela Admin API (`inviteUserByEmail`/`generateLink`).
 *
 * Lança `Error` em vez de devolver uma resposta HTTP — cada chamador decide o
 * formato do erro (JSON de rota, ou `ActionState` de server action).
 */
export async function provisionAuthUser(
  admin: SupabaseClient<Database>,
  email: string,
  fullName: string,
): Promise<ProvisionedUser> {
  // O destino do link. Precisa estar na lista de Redirect URLs do projeto
  // Supabase (Authentication → URL Configuration) — ver README.
  const redirectTo = `${publicEnv.siteUrl}/convite`;

  let userId: string | null = null;
  let inviteUrl: string | null = null;
  let emailSent = false;
  let jaTinhaConta = false;

  const convite = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: fullName },
  });

  if (!convite.error && convite.data.user) {
    userId = convite.data.user.id;
    emailSent = true;
  } else {
    const message = convite.error?.message ?? "erro desconhecido";
    const code = convite.error?.code ?? "";
    const jaExiste =
      code === "email_exists" ||
      /already been registered|already registered|already exists/i.test(message);

    if (jaExiste) {
      jaTinhaConta = true;
    } else {
      // Falha de envio (SMTP ausente, limite do remetente compartilhado,
      // domínio recusado). O convite não pode morrer aqui: `generateLink` cria
      // a mesma conta pela mesma Admin API e devolve o link SEM tentar enviar.
      console.error("[provisionAuthUser] inviteUserByEmail falhou (%s): %s", code, message);
      const gerado = await admin.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo, data: { full_name: fullName } },
      });
      if (gerado.error || !gerado.data.user) {
        const detalhe = gerado.error?.message ?? "sem detalhe";
        if (/already been registered|already registered|already exists/i.test(detalhe)) {
          jaTinhaConta = true;
        } else {
          console.error("[provisionAuthUser] generateLink(invite) falhou: %s", detalhe);
          throw new Error(`Não foi possível criar o convite no provedor de autenticação: ${detalhe}`);
        }
      } else {
        userId = gerado.data.user.id;
        inviteUrl = ownInviteLink(gerado.data.properties);
      }
    }
  }

  // Conta já existente (a pessoa foi convidada antes, ou tem acesso a outra
  // organização): não se cria nada em auth, só se gera o link de acesso.
  // `recovery` é o tipo certo porque o login deste painel é por senha — um
  // magic link deixaria a pessoa sem senha para o segundo acesso.
  if (jaTinhaConta || (userId && !inviteUrl)) {
    const recuperacao = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });
    if (recuperacao.error || !recuperacao.data.user) {
      const detalhe = recuperacao.error?.message ?? "sem detalhe";
      console.error("[provisionAuthUser] generateLink(recovery) falhou: %s", detalhe);
      if (!userId) throw new Error(`Não foi possível gerar o link de acesso: ${detalhe}`);
    } else {
      userId = userId ?? recuperacao.data.user.id;
      inviteUrl = inviteUrl ?? ownInviteLink(recuperacao.data.properties);
    }
  }

  if (!userId) {
    throw new Error("O provedor de autenticação não devolveu a conta convidada.");
  }

  return { userId, inviteUrl, emailSent };
}
