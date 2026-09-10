import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";
import { consumeStrict, tooManyRequests } from "@/lib/ratelimit";
import { provisionAuthUser } from "@/lib/admin/authProvisioning";

/**
 * Convite de equipe.
 *
 * ── Por que esta rota pode usar o service role ───────────────────────────────
 * Criar a conta de autenticação é a única operação do painel que a RLS não
 * alcança: `auth.users` não é uma tabela do PostgREST e não tem policy. Tudo o
 * mais aqui — a autorização de quem convida e a criação do vínculo em
 * `org_members` — continua sob RLS, com o cliente de sessão. O service role é
 * usado em exatamente duas chamadas: a Admin API de auth e o balde de rate
 * limit (cuja função `public.consume_rate_limit` só tem EXECUTE para
 * service_role).
 *
 * ── ARMADILHA REGISTRADA NO README: nunca criar usuário por SQL ─────────────
 * Um `insert into auth.users (...)` deixa `confirmation_token`,
 * `recovery_token`, `email_change_token_new` e `email_change` como NULL. O
 * GoTrue é escrito em Go e faz scan dessas colunas em `string`; NULL derruba a
 * consulta com `converting NULL to string is unsupported`, e o sintoma que
 * chega ao usuário é "Database error querying schema" — no LOGIN INTEIRO do
 * projeto, não só para o usuário criado. Este arquivo só toca em auth pela
 * Admin API (`inviteUserByEmail` / `generateLink`), e nenhuma outra parte do
 * projeto pode criar usuário.
 *
 * ── SMTP e o link devolvido ─────────────────────────────────────────────────
 * O projeto não manda e-mail próprio (decisão do cliente: notificação só no
 * painel). `inviteUserByEmail` usa o SMTP do projeto Supabase, que sem
 * configuração é o remetente compartilhado — limitado a poucos envios por hora
 * e, na prática, só para endereços da própria equipe do projeto. Por isso a
 * resposta SEMPRE traz `inviteUrl`, e a tela sempre o mostra: sem ele, um
 * cliente com SMTP não configurado simplesmente não consegue adicionar
 * ninguém ao canal.
 *
 * ── Auditoria ───────────────────────────────────────────────────────────────
 * Nada é gravado em JS. O INSERT em `org_members` dispara
 * `t_org_member_audit` (migração 027), que emite `invite.sent` com papel e
 * situação na mesma transação — e como o INSERT vai sob RLS, o ator registrado
 * é o admin que convidou, não o service role.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.email("Informe um e-mail válido.").max(320).transform(value => value.trim().toLowerCase()),
  fullName: z
    .string()
    .trim()
    .min(3, "Informe o nome completo de quem vai receber o convite.")
    .max(120, "Nome longo demais."),
  role: z.enum(["admin", "triagem", "investigador", "comite"], "Escolha um papel válido."),
});

function bad(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  // 1. Sessão de staff. `getStaffContext` já exige vínculo ATIVO e redireciona
  //    quem não tem — a rota nunca roda para um anônimo.
  const staff = await getStaffContext();
  const supabase = await createClient();

  // 2. Autorização SOB RLS, antes de qualquer chave privilegiada aparecer.
  //    `members_read` só devolve vínculos da organização de quem pergunta; se
  //    esta consulta volta vazia, quem chamou não é admin ativo daqui.
  const { data: caller } = await supabase
    .from("org_members")
    .select("id")
    .eq("org_id", staff.orgId)
    .eq("user_id", staff.userId)
    .eq("role", "admin")
    .eq("status", "active")
    .maybeSingle();

  if (!caller) {
    return bad(403, "Só quem tem o papel Administração pode convidar pessoas para o canal.");
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return bad(400, parsed.error.issues[0]?.message ?? "Dados inválidos.");
  }
  const { email, fullName, role } = parsed.data;

  const admin = createAdminClient();

  // 3. Rate limit por administrador, fail-closed. A rota cria conta de
  //    autenticação e dispara e-mail: sem balde, uma sessão roubada viraria
  //    máquina de spam com o domínio do cliente no remetente.
  const limit = await consumeStrict(admin, "admin_invite", `invite:${staff.userId}`, 10, "01:00:00");
  if (limit === "limited") return tooManyRequests(3600);
  if (limit === "unavailable") {
    return bad(503, "O limitador de convites está indisponível. Tente novamente em alguns minutos.");
  }

  let userId: string;
  let inviteUrl: string | null;
  let emailSent: boolean;
  try {
    ({ userId, inviteUrl, emailSent } = await provisionAuthUser(admin, email, fullName));
  } catch (error) {
    return bad(502, error instanceof Error ? error.message : "Falha ao provisionar a conta.");
  }

  // 4. O VÍNCULO VAI SOB RLS, com o cliente de sessão. A policy
  //    `members_insert` (`app.has_role(org_id, {admin})`) é a autorização de
  //    verdade — o `if` lá em cima é só cortesia — e o INSERT dispara o
  //    trigger de auditoria com o admin como ator.
  //    `status: 'invited'` é o default da coluna, explícito aqui porque é a
  //    peça que faz `getStaffContext()` mandar o convidado para /sem-acesso
  //    até o primeiro acesso ativar o vínculo (ver /convite).
  const { data: vinculo, error: vinculoError } = await supabase
    .from("org_members")
    .insert({
      org_id: staff.orgId,
      user_id: userId,
      role,
      status: "invited",
      invited_by: staff.userId,
    })
    .select("id, status")
    .maybeSingle();

  if (vinculoError) {
    // 23505 é o UNIQUE (org_id, user_id): a pessoa já está na equipe.
    if (vinculoError.code === "23505") {
      return Response.json(
        {
          ok: true,
          emailSent,
          inviteUrl,
          memberStatus: "existente",
          message:
            "Essa pessoa já tem vínculo com esta organização. Nenhum vínculo novo foi criado — o link acima serve para ela redefinir a senha e entrar. Confira o papel e a situação dela na lista acima.",
        },
        { status: 200 },
      );
    }
    console.error("[convite] insert em org_members recusado: %s", vinculoError.message);
    return bad(
      500,
      "A conta foi criada, mas o vínculo com a organização não. Recarregue e tente convidar de novo.",
    );
  }

  if (!vinculo) {
    // RLS barrando INSERT não levanta erro no PostgREST: volta vazio.
    return bad(
      403,
      "A conta foi criada, mas a política de acesso recusou criar o vínculo. Confirme que você ainda é administrador ativo desta organização.",
    );
  }

  return Response.json(
    {
      ok: true,
      emailSent,
      inviteUrl,
      memberStatus: vinculo.status,
      message: emailSent
        ? "A pessoa recebeu um e-mail com o link para definir a senha. Se ele não chegar (o projeto não tem SMTP próprio configurado), use o link abaixo."
        : "O e-mail não pôde ser enviado por este projeto Supabase. O convite existe e o vínculo foi criado — entregue o link abaixo você mesmo.",
    },
    { status: 201 },
  );
}
