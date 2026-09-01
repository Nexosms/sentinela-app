"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaffContext } from "@/lib/org/context";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

/**
 * Mutações do caso. Todas rodam sob RLS (`createClient`) — a autorização é a
 * política do Postgres, nunca um `if` de papel aqui. O papel só aparece em
 * `concederAcessoIdentidade`, e ainda assim para escolher o MECANISMO
 * (conceder direto ou pedir a um administrador), não para liberar dado.
 *
 * Nenhuma delas grava auditoria: `t_reports_audit` e `t_messages_audit` já
 * emitem `report.status_changed`, `report.risk_changed`, `report.assigned`,
 * `report.closed` e `staff.message_sent` na mesma transação do UPDATE/INSERT.
 * Repetir em JS duplicaria linha numa tabela que é imutável por RULE.
 */

export type ActionState = {
  ok?: true;
  error?: string;
  aviso?: string;
  /**
   * Eco do que foi digitado. O React limpa um `<form action=…>` assim que a
   * ação termina — inclusive quando ela recusou. Sem devolver o texto, um
   * resumo de fechamento de 300 caracteres evaporaria por causa de um erro de
   * 30, e a pessoa reescreveria tudo.
   */
  enviado?: Record<string, string>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const idSchema = z.string().regex(UUID, "Relato inválido.");

const STATUS = [
  "em_triagem",
  "em_apuracao",
  "aguardando_informacao",
  "concluida",
  "arquivada",
] as const;

const RISK = ["baixo", "moderado", "alto", "critico"] as const;

/** Status em que o caso está encerrado: exigem resumo de fechamento. */
const CLOSING: readonly (typeof STATUS)[number][] = ["concluida", "arquivada"];

/** Ordem de gravidade — "subir o risco" precisa de uma comparação, não de uma lista. */
const RISK_RANK: Record<(typeof RISK)[number], number> = {
  baixo: 1,
  moderado: 2,
  alto: 3,
  critico: 4,
};

const MIN_CLOSURE = 30;
const MIN_RISK_RATIONALE = 15;

/**
 * Texto padrão do atalho "Solicitar complementação" do rodapé do caso. O botão
 * não tem onde receber texto sem quebrar o `.case-actions`; quem quiser
 * escrever à mão usa a aba Mensagens, que manda a mesma coisa com corpo
 * próprio. Neutro de propósito: nada aqui pode sugerir a resposta.
 */
const COMPLEMENT_DEFAULT =
  "Precisamos de mais informações para seguir com a apuração deste relato. " +
  "Se puder, descreva datas, locais, pessoas envolvidas ou qualquer registro " +
  "que ajude a entender o que aconteceu. Responda por aqui, no acompanhamento " +
  "do seu protocolo. Se preferir não responder, o caso segue com o que já temos.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

/** Só campos de texto do próprio formulário voltam para a tela. */
function echo(formData: FormData, ...names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") out[name] = value;
  }
  return out;
}

/**
 * Lê o relato sob RLS. Voltar vazio já é a resposta de autorização: quem não
 * pode ver não pode mudar, e é a política que decide isso.
 */
async function loadReport(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, org_id, status, risk, assigned_to")
    .eq("id", id)
    .maybeSingle();
  return data;
}

function revalidateCase(id: string) {
  revalidatePath(`/admin/denuncias/${id}`);
  revalidatePath("/admin/denuncias");
  // O sino da topbar vive no layout do admin.
  revalidatePath("/admin", "layout");
}

/** Erro do PostgREST vira mensagem de gente; o detalhe fica no log do servidor. */
function fail(escopo: string, message: string, humano: string): ActionState {
  console.error("[caso] %s: %s", escopo, message);
  return { error: humano };
}

// ── Status ───────────────────────────────────────────────────────────────────

const statusSchema = z.object({
  id: idSchema,
  status: z.enum(STATUS, { message: "Selecione um status válido." }),
  rationale: z.string().trim().max(2000, "Justificativa longa demais.").optional(),
  closure_summary: z.string().trim().max(4000, "Resumo longo demais.").optional(),
});

/**
 * Encerrar um caso sem dizer por quê é o que torna o canal indefensável numa
 * auditoria da Lei 14.457 — daí o resumo obrigatório para `concluida` e
 * `arquivada`. O resumo mora em `reports.closure_summary` e nunca na auditoria.
 */
export async function alterarStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = statusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
    rationale: text(formData, "rationale"),
    closure_summary: text(formData, "closure_summary"),
  });
  const eco = echo(formData, "rationale", "closure_summary");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { id, status, rationale, closure_summary: summary } = parsed.data;
  eco.status = status;

  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente.", enviado: eco };

  const report = await loadReport(id);
  if (!report) return { error: "Relato não encontrado ou fora do seu acesso.", enviado: eco };
  if (report.status === status) return { error: "O caso já está neste status.", enviado: eco };

  const closing = CLOSING.includes(status);
  if (closing && (summary ?? "").length < MIN_CLOSURE) {
    return {
      error: `Para concluir ou arquivar, escreva um resumo de fechamento com pelo menos ${MIN_CLOSURE} caracteres.`,
      enviado: eco,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({
      status,
      // Reabrir um caso desfaz o fechamento: `closed_at` preso no passado
      // envenenaria qualquer indicador de tempo de resposta.
      closed_at: closing ? new Date().toISOString() : null,
      ...(closing ? { closure_summary: summary } : {}),
    })
    .eq("id", id);

  if (error) {
    return { ...fail("status", error.message, "Não foi possível alterar o status."), enviado: eco };
  }

  // `report_status_history` é somente leitura sob RLS e o trigger que a
  // preenche não recebe a justificativa. Para o texto não se perder, ele vira
  // nota interna — que o denunciante nunca vê e que a trilha registra pelo
  // tamanho, nunca pelo conteúdo.
  if (rationale) {
    await supabase.from("report_messages").insert({
      report_id: id,
      org_id: report.org_id,
      author_type: "staff",
      author_id: user.id,
      internal: true,
      body: `Justificativa da mudança de status: ${rationale}`,
    });
  }

  revalidateCase(id);
  return { ok: true };
}

// ── Risco ────────────────────────────────────────────────────────────────────

const riskSchema = z.object({
  id: idSchema,
  risk: z.enum(RISK, { message: "Selecione um nível de risco válido." }),
  risk_rationale: z.string().trim().max(2000, "Justificativa longa demais.").optional(),
});

/**
 * Subir o risco muda prazo, prioridade e quem é avisado. Sem justificativa
 * escrita, a decisão não se sustenta depois — por isso ela é obrigatória ao
 * passar para alto ou crítico.
 */
export async function alterarRisco(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = riskSchema.safeParse({
    id: formData.get("id"),
    risk: formData.get("risk"),
    risk_rationale: text(formData, "risk_rationale"),
  });
  const eco = echo(formData, "risk", "risk_rationale");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { id, risk } = parsed.data;
  const rationale = parsed.data.risk_rationale ?? "";

  const report = await loadReport(id);
  if (!report) return { error: "Relato não encontrado ou fora do seu acesso.", enviado: eco };

  if (report.risk === risk && rationale.length === 0) {
    return {
      error: "Escolha um nível de risco diferente do atual ou escreva uma justificativa.",
      enviado: eco,
    };
  }

  const rising = RISK_RANK[risk] > RISK_RANK[report.risk];
  if (rising && (risk === "alto" || risk === "critico") && rationale.length < MIN_RISK_RATIONALE) {
    return {
      error: `Para elevar o risco a ${risk === "alto" ? "alto" : "crítico"}, escreva uma justificativa com pelo menos ${MIN_RISK_RATIONALE} caracteres.`,
      enviado: eco,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .update({ risk, ...(rationale ? { risk_rationale: rationale } : {}) })
    .eq("id", id);

  if (error) {
    return {
      ...fail("risco", error.message, "Não foi possível registrar a avaliação de risco."),
      enviado: eco,
    };
  }

  revalidateCase(id);
  return { ok: true };
}

// ── Responsável ──────────────────────────────────────────────────────────────

const assignSchema = z.object({
  id: idSchema,
  assigned_to: z.union([idSchema, z.literal("")]),
});

/**
 * A RLS deixaria a atribuição a um impedido passar — e logo depois esconderia o
 * caso da própria pessoa, que ficaria responsável por algo que não consegue
 * abrir. Recusar aqui, com o motivo na tela, é melhor que a atribuição fantasma.
 */
export async function atribuirResponsavel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = assignSchema.safeParse({
    id: formData.get("id"),
    assigned_to: formData.get("assigned_to") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id } = parsed.data;
  const assignee = parsed.data.assigned_to === "" ? null : parsed.data.assigned_to;

  const report = await loadReport(id);
  if (!report) return { error: "Relato não encontrado ou fora do seu acesso." };

  const supabase = await createClient();

  if (assignee) {
    const { data: member } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("user_id", assignee)
      .eq("org_id", report.org_id)
      .eq("status", "active")
      .maybeSingle();
    if (!member) {
      return { error: "Essa pessoa não é membro ativo desta organização." };
    }

    const { data: recusal } = await supabase
      .from("report_recusals")
      .select("user_id")
      .eq("report_id", id)
      .eq("user_id", assignee)
      .maybeSingle();
    if (recusal) {
      return {
        error:
          "Essa pessoa declarou impedimento neste relato e não pode ser designada. Escolha outra.",
      };
    }
  }

  const { error } = await supabase
    .from("reports")
    .update({ assigned_to: assignee })
    .eq("id", id);

  if (error) return fail("atribuição", error.message, "Não foi possível designar o responsável.");

  revalidateCase(id);
  return { ok: true };
}

// ── Mensagens ────────────────────────────────────────────────────────────────

const messageSchema = z.object({
  id: idSchema,
  body: z
    .string()
    .trim()
    .min(1, "Escreva a mensagem antes de enviar.")
    .max(4000, "A mensagem passa de 4000 caracteres."),
  internal: z.boolean(),
});

/**
 * `author_type` e `author_id` não são escolha: a policy de INSERT exige
 * exatamente `staff` + `auth.uid()`. Qualquer outra combinação volta 42501.
 */
export async function enviarMensagem(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = messageSchema.safeParse({
    id: formData.get("id"),
    body: text(formData, "body"),
    internal: formData.get("internal") === "1",
  });
  const eco = echo(formData, "body");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { id, body, internal } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente.", enviado: eco };

  const report = await loadReport(id);
  if (!report) return { error: "Relato não encontrado ou fora do seu acesso.", enviado: eco };

  const supabase = await createClient();
  const { error } = await supabase.from("report_messages").insert({
    report_id: id,
    org_id: report.org_id,
    author_type: "staff",
    author_id: user.id,
    internal,
    body,
  });

  if (error) {
    return {
      ...fail("mensagem", error.message, "Não foi possível enviar a mensagem."),
      enviado: eco,
    };
  }

  revalidateCase(id);
  return { ok: true };
}

// ── Complementação ───────────────────────────────────────────────────────────

/**
 * Atalho: uma só ação põe o caso em "aguardando informação" e avisa quem
 * relatou. A mensagem é sempre externa — pedir complementação numa nota interna
 * seria esperar resposta de quem nunca leu o pedido.
 */
export async function solicitarComplementacao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const escrito = text(formData, "body");
  const parsed = messageSchema.safeParse({
    id: formData.get("id"),
    body: escrito.length > 0 ? escrito : COMPLEMENT_DEFAULT,
    internal: false,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, body } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const report = await loadReport(id);
  if (!report) return { error: "Relato não encontrado ou fora do seu acesso." };

  const supabase = await createClient();
  const { error: messageError } = await supabase.from("report_messages").insert({
    report_id: id,
    org_id: report.org_id,
    author_type: "staff",
    author_id: user.id,
    internal: false,
    body,
  });
  if (messageError) {
    return fail("complementação", messageError.message, "Não foi possível enviar o pedido.");
  }

  if (report.status !== "aguardando_informacao") {
    const { error } = await supabase
      .from("reports")
      .update({ status: "aguardando_informacao", closed_at: null })
      .eq("id", id);
    if (error) {
      return fail(
        "complementação",
        error.message,
        "O pedido foi enviado, mas o status não mudou. Ajuste o status manualmente.",
      );
    }
  }

  revalidateCase(id);
  return { ok: true };
}

// ── Identidade (break-glass) ─────────────────────────────────────────────────

const identitySchema = z.object({
  id: idSchema,
  justification: z
    .string()
    .trim()
    .min(20, "A justificativa precisa ter ao menos 20 caracteres.")
    .max(2000, "Justificativa longa demais."),
});

/**
 * Validade de 2 horas. O teto da policy é 24 h, mas teto não é valor sensato:
 * quem precisa do nome para uma ligação precisa dele agora, não pelo resto do
 * dia. Vencido, o acesso some sozinho e um novo pedido fica registrado.
 */
const GRANT_HOURS = 2;

export async function concederAcessoIdentidade(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = identitySchema.safeParse({
    id: formData.get("id"),
    justification: text(formData, "justification"),
  });
  const eco = echo(formData, "justification");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { id, justification } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const report = await loadReport(id);
  if (!report) return { error: "Relato não encontrado ou fora do seu acesso." };

  const supabase = await createClient();
  const staff = await getStaffContext();

  // Papel aqui escolhe o CAMINHO, não o direito: a policy de INSERT de
  // `identity_access_grants` só aceita admin de qualquer jeito, e a RPC está
  // aberta a quem enxerga o relato. Sem esta bifurcação, o não-admin levaria um
  // 42501 seco em vez do pedido que ele de fato pode fazer.
  if (staff.role === "admin") {
    const expires = new Date(Date.now() + GRANT_HOURS * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("identity_access_grants").insert({
      org_id: report.org_id,
      report_id: id,
      user_id: user.id,
      granted_by: user.id,
      justification,
      expires_at: expires,
    });
    if (error) {
      return {
        ...fail("identidade", error.message, "Não foi possível abrir o acesso à identidade."),
        enviado: eco,
      };
    }
    revalidateCase(id);
    return { ok: true };
  }

  const { error } = await supabase.rpc("request_identity_access", {
    p_report: id,
    p_justification: justification,
  });
  if (error) {
    return {
      ...fail("identidade", error.message, "Não foi possível registrar o pedido de acesso."),
      enviado: eco,
    };
  }

  revalidateCase(id);
  return {
    ok: true,
    aviso:
      "Pedido registrado e enviado aos administradores. O acesso depende da concessão de um deles.",
  };
}
