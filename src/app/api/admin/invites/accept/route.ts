import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

/**
 * Primeiro acesso do convidado: transforma o próprio vínculo de `invited` em
 * `active`.
 *
 * ── Por que esta rota existe (a decisão de ativação) ─────────────────────────
 * `getStaffContext()` exige `status = 'active'`, então o convidado cai em
 * /sem-acesso até que alguém ative o vínculo. Havia duas saídas: o admin
 * ativar na tela de Equipe, ou o primeiro acesso ativar sozinho. A segunda foi
 * escolhida porque a primeira transforma todo convite em duas tarefas
 * assíncronas de duas pessoas — o convidado define a senha, esbarra em
 * /sem-acesso, avisa o admin, o admin volta ao painel e libera. O botão
 * "Liberar acesso agora" continua na tela de Equipe como saída manual para
 * quando o link não funciona.
 *
 * ── Por que ela usa o service role ──────────────────────────────────────────
 * Sob RLS o convidado não consegue se ativar: `members_update` exige
 * `app.has_role(org, {admin})`, e `app.has_role` só enxerga vínculos ATIVOS —
 * um convidado não é admin de nada. A alternativa seria uma função
 * SECURITY DEFINER nova no banco (migração); enquanto ela não existe, esta
 * rota faz o mesmo papel com o escopo mais estreito possível:
 *
 *   - a identidade vem de `getUser()`, validada contra o servidor de auth;
 *   - o filtro é `user_id = <o próprio>`, nunca um id vindo do corpo;
 *   - a única transição permitida é `invited → active`. Um vínculo
 *     `suspended` não é reativado por aqui — quem foi suspenso continua
 *     suspenso, e só um admin desfaz isso.
 *
 * A auditoria sai sozinha: `t_org_member_audit` emite `member.reactivated` na
 * mesma transação do UPDATE.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Sessão ausente ou expirada." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("org_members")
    .update({ status: "active", activated_at: new Date().toISOString(), revoked_at: null })
    .eq("user_id", user.id)
    .eq("status", "invited")
    .select("id, org_id");

  if (error) {
    console.error("[convite] ativação recusada: %s", error.message);
    return Response.json({ error: "Não foi possível ativar o seu acesso." }, { status: 500 });
  }

  // Zero linhas não é erro: ou o vínculo já estava ativo (segundo clique no
  // link), ou foi suspenso antes do primeiro acesso. A tela decide o que dizer.
  return Response.json({ ok: true, ativados: data?.length ?? 0 }, { status: 200 });
}
