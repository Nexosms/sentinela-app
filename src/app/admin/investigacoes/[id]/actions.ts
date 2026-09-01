"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getStaffContext } from "@/lib/org/context";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import {
  CONFIDENCE,
  EDITABLE_STATUS,
  INVESTIGATION_PATH,
  INTERVIEW_KIND_ORDER,
  OUTCOME_ORDER,
  ROLE_IN_CASE,
  UUID,
} from "@/lib/admin/investigacoes";

/**
 * Mutações da investigação. Todas rodam sob RLS (`createClient`): quem autoriza
 * é a política do Postgres, nunca um `if` de papel aqui.
 *
 * Nenhuma grava auditoria. Os triggers da migração 024 (Agente E) emitem os
 * eventos na mesma transação da mutação; repetir em JS duplicaria linha numa
 * tabela imutável por RULE.
 *
 * Duas checagens neste arquivo NÃO são cortesia de interface e sim regra de
 * negócio que o banco não cobre:
 *
 * 1. `reviewed_at IS NULL` nas tabelas-filhas. A policy `inv_update` tranca
 *    `investigations` depois de assinada, mas `investigation_members`,
 *    `_interviews`, `_findings` e `_reports` herdam apenas o `EXISTS` da
 *    investigação — que continua visível. Sem a recusa abaixo, seria possível
 *    acrescentar um achado a uma investigação já concluída e assinada.
 * 2. A declaração de impedimento. `conflict_statement` é anulável no banco;
 *    é aqui que ela vira obrigatória, porque adicionar membro concede leitura
 *    às denúncias vinculadas (`reports_staff_read`).
 *
 * ⚠️ E uma armadilha do PostgREST que vale para TODO update em
 * `investigations`: quando o `USING` da policy esconde a linha, o UPDATE não
 * levanta erro — ele afeta ZERO linhas e devolve `error: null`. Uma ação
 * ingênua diria "salvo" sobre uma gravação que não aconteceu. Por isso todo
 * update aqui pede `.select("id")` de volta e trata a lista vazia como recusa.
 */

export type ActionState = {
  ok?: true;
  error?: string;
  aviso?: string;
  /**
   * Eco do que foi digitado. O React limpa um `<form action=…>` assim que a
   * ação termina — inclusive quando ela recusou. Sem devolver o texto, um
   * roteiro de entrevista inteiro evaporaria por causa de um campo faltando.
   */
  enviado?: Record<string, string>;
};

const idSchema = z.string().regex(UUID, "Investigação inválida.");

/** Fuso fixo do Brasil desde 2019 (sem horário de verão). `datetime-local` não traz offset. */
const BR_OFFSET = "-03:00";

const MIN_CONFLICT = 40;
const MIN_FINDINGS = 30;
const MIN_RECOMMENDATION = 20;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Campo vazio de formulário é `""`, e `""` num `date`/`uuid` do Postgres é 22P02. */
function nullable(formData: FormData, name: string): string | null {
  const value = text(formData, name);
  return value.length > 0 ? value : null;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

function echo(formData: FormData, ...names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") out[name] = value;
  }
  return out;
}

function fail(escopo: string, message: string, humano: string): ActionState {
  console.error("[investigação] %s: %s", escopo, message);
  return { error: humano };
}

function revalidateInvestigation(id: string) {
  revalidatePath(`${INVESTIGATION_PATH}/${id}`);
  revalidatePath(INVESTIGATION_PATH);
  revalidatePath("/admin", "layout");
}

/**
 * Lê a investigação sob RLS. Voltar vazio já é a resposta de autorização: quem
 * não pode ver não pode mudar, e é a política que decide isso.
 */
async function loadInvestigation(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("investigations")
    .select("id, org_id, status, lead_id, reviewed_at, findings, recommendation, outcome")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/**
 * Zero linhas afetadas num UPDATE de `investigations` não é sucesso: é o
 * `USING` da policy escondendo a linha (tipicamente porque `reviewed_at`
 * deixou de ser nulo entre a leitura e a escrita). O PostgREST não erra nesse
 * caso, então a checagem tem que ser explícita.
 */
const VANISHED =
  "A investigação saiu do seu alcance de escrita entre abrir a tela e salvar — provavelmente alguém a assinou. Recarregue a página.";

const SIGNED_OFF =
  "Esta investigação já foi revisada e assinada. Depois da assinatura nada mais pode ser escrito — nem por quem conduziu.";

/**
 * Todo caminho de escrita passa por aqui: carrega a investigação e recusa se
 * ela já estiver assinada. Devolve `{ inv }` ou `{ error }`.
 */
async function openForWriting(id: string) {
  const inv = await loadInvestigation(id);
  if (!inv) return { error: "Investigação não encontrada ou fora do seu acesso." as const };
  if (inv.reviewed_at !== null) return { error: SIGNED_OFF };
  return { inv };
}

// ── Criação ──────────────────────────────────────────────────────────────────

const criarSchema = z.object({
  report_id: z.union([z.string().regex(UUID), z.literal("")]),
  lead_id: z.union([z.string().regex(UUID), z.literal("")]),
  scope: z
    .string()
    .trim()
    .min(20, "Descreva o escopo da apuração com pelo menos 20 caracteres.")
    .max(4000, "Escopo longo demais."),
  planned_start: z.string().trim(),
  planned_end: z.string().trim(),
});

/**
 * `investigations.code` é NOT NULL e sem default: quem gera é
 * `app.next_code(org, 'INV')`, que devolve `INV-2026-0001` numa sequência por
 * organização (UNIQUE `(org_id, code)`). Gerar o número em JS abriria corrida
 * entre duas abas abertas ao mesmo tempo.
 *
 * `app.next_code` mora no schema `app`, que o PostgREST não expõe; quem
 * atende a chamada é o wrapper `public.next_code` da migração 025, que confere
 * o vínculo com a organização (42501 se não houver) antes de delegar.
 */
export async function criarInvestigacao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = criarSchema.safeParse({
    report_id: formData.get("report_id") ?? "",
    lead_id: formData.get("lead_id") ?? "",
    scope: text(formData, "scope"),
    planned_start: text(formData, "planned_start"),
    planned_end: text(formData, "planned_end"),
  });
  const eco = echo(formData, "report_id", "lead_id", "scope", "planned_start", "planned_end");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { scope } = parsed.data;
  const reportId = parsed.data.report_id || null;
  const leadId = parsed.data.lead_id || null;
  const plannedStart = parsed.data.planned_start || null;
  const plannedEnd = parsed.data.planned_end || null;

  if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
    return { error: "O fim planejado não pode ser anterior ao início.", enviado: eco };
  }

  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente.", enviado: eco };
  const staff = await getStaffContext();

  const supabase = await createClient();
  const { data: code, error: codeError } = await supabase.rpc("next_code", {
    p_org: staff.orgId,
    p_prefix: "INV",
  });

  if (codeError || !code) {
    return {
      ...fail(
        "código",
        codeError?.message ?? "next_code devolveu vazio",
        "Não foi possível gerar o código da investigação. A função app.next_code (migração 024) precisa estar aplicada.",
      ),
      enviado: eco,
    };
  }

  const { data: created, error } = await supabase
    .from("investigations")
    .insert({
      org_id: staff.orgId,
      code,
      scope,
      lead_id: leadId,
      created_by: user.id,
      planned_start: plannedStart,
      planned_end: plannedEnd,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    return {
      ...fail("criação", error?.message ?? "insert sem retorno", "Não foi possível abrir a investigação."),
      enviado: eco,
    };
  }

  if (reportId) {
    // A primeira denúncia vinculada é a principal — é a que deu origem à apuração.
    const { error: linkError } = await supabase
      .from("investigation_reports")
      .insert({ investigation_id: created.id, report_id: reportId, is_primary: true });
    if (linkError) {
      // A investigação já existe: melhor levar a pessoa até ela e avisar do
      // vínculo que faltou do que perder o escopo já escrito.
      console.error("[investigação] vínculo inicial: %s", linkError.message);
    }
  }

  revalidateInvestigation(created.id);
  redirect(`${INVESTIGATION_PATH}/${created.id}`);
}

// ── Plano ────────────────────────────────────────────────────────────────────

const planoSchema = z.object({
  id: idSchema,
  scope: z.string().trim().max(4000, "Escopo longo demais."),
  hypotheses: z.string().trim().max(4000, "Hipóteses longas demais."),
  methodology: z.string().trim().max(4000, "Metodologia longa demais."),
  protective_measures: z.string().trim().max(4000, "Medidas protetivas longas demais."),
  planned_start: z.string().trim(),
  planned_end: z.string().trim(),
  lead_id: z.union([z.string().regex(UUID), z.literal("")]),
  status: z.enum(EDITABLE_STATUS, { message: "Selecione um status válido." }),
});

/**
 * O plano de apuração é o que um auditor lê primeiro: escopo, hipóteses,
 * metodologia e medidas protetivas escritos ANTES de ouvir alguém. Editável só
 * enquanto ninguém assinou.
 */
export async function salvarPlano(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = planoSchema.safeParse({
    id: formData.get("id"),
    scope: text(formData, "scope"),
    hypotheses: text(formData, "hypotheses"),
    methodology: text(formData, "methodology"),
    protective_measures: text(formData, "protective_measures"),
    planned_start: text(formData, "planned_start"),
    planned_end: text(formData, "planned_end"),
    lead_id: formData.get("lead_id") ?? "",
    status: formData.get("status"),
  });
  const eco = echo(
    formData,
    "scope",
    "hypotheses",
    "methodology",
    "protective_measures",
    "planned_start",
    "planned_end",
    "lead_id",
    "status",
  );
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { id } = parsed.data;
  const plannedStart = parsed.data.planned_start || null;
  const plannedEnd = parsed.data.planned_end || null;

  if (plannedStart && plannedEnd && plannedEnd < plannedStart) {
    return { error: "O fim planejado não pode ser anterior ao início.", enviado: eco };
  }

  const aberto = await openForWriting(id);
  if ("error" in aberto) return { error: aberto.error, enviado: eco };
  const { inv } = aberto;

  const status = parsed.data.status;
  const leadId = parsed.data.lead_id || null;

  // `inv_reviewer_not_lead` compara `reviewed_by` com `lead_id`. Trocar o líder
  // por quem já assinou é impossível aqui (assinada não edita), mas a troca
  // ainda precisa recair sobre alguém que exista na organização.
  if (leadId) {
    const supabase = await createClient();
    const { data: member } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("user_id", leadId)
      .eq("org_id", inv.org_id)
      .eq("status", "active")
      .maybeSingle();
    if (!member) return { error: "Essa pessoa não é membro ativo desta organização.", enviado: eco };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("investigations")
    .update({
      scope: parsed.data.scope || null,
      hypotheses: parsed.data.hypotheses || null,
      methodology: parsed.data.methodology || null,
      protective_measures: parsed.data.protective_measures || null,
      planned_start: plannedStart,
      planned_end: plannedEnd,
      lead_id: leadId,
      status,
      // A apuração começa quando o status diz que começou, e a data não se
      // reescreve a cada salvamento.
      started_at:
        status === "em_andamento" && inv.status !== "em_andamento"
          ? new Date().toISOString()
          : undefined,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ...fail("plano", error.message, "Não foi possível salvar o plano."), enviado: eco };
  }
  if (!updated || updated.length === 0) return { error: VANISHED, enviado: eco };

  revalidateInvestigation(id);
  return { ok: true };
}

// ── Equipe ───────────────────────────────────────────────────────────────────

const membroSchema = z.object({
  id: idSchema,
  user_id: z.string().regex(UUID, "Escolha quem entra na equipe."),
  role_in_case: z.enum(ROLE_IN_CASE, { message: "Escolha o papel desta pessoa no caso." }),
  conflict_statement: z
    .string()
    .trim()
    .min(
      MIN_CONFLICT,
      `A declaração de impedimento precisa de pelo menos ${MIN_CONFLICT} caracteres — ela é o que sustenta a apuração numa auditoria.`,
    )
    .max(2000, "Declaração longa demais."),
  confirmado: z.literal("1", {
    message:
      "Marque a afirmação de que esta pessoa não é a denunciada nem tem relação de subordinação ou gestão com ela.",
  }),
});

/**
 * Adicionar alguém à equipe é uma CONCESSÃO DE ACESSO: `reports_staff_read`
 * inclui os membros da investigação, então a pessoa passa a ler as denúncias
 * vinculadas. Por isso a declaração de impedimento é obrigatória aqui, mesmo
 * sendo anulável no banco — investigação conduzida por quem tem conflito é
 * nula, e a prática da CIPA prevê comitê alternativo nesse caso.
 */
export async function adicionarMembro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = membroSchema.safeParse({
    id: formData.get("id"),
    user_id: formData.get("user_id"),
    role_in_case: formData.get("role_in_case"),
    conflict_statement: text(formData, "conflict_statement"),
    confirmado: formData.get("confirmado") ?? "",
  });
  const eco = echo(formData, "user_id", "role_in_case", "conflict_statement");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { id, user_id: userId, role_in_case: role, conflict_statement: statement } = parsed.data;

  const aberto = await openForWriting(id);
  if ("error" in aberto) return { error: aberto.error, enviado: eco };
  const { inv } = aberto;

  const author = await getAuthenticatedUser();
  if (!author) return { error: "Sessão expirada. Entre novamente.", enviado: eco };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("user_id", userId)
    .eq("org_id", inv.org_id)
    .eq("status", "active")
    .maybeSingle();
  if (!member) return { error: "Essa pessoa não é membro ativo desta organização.", enviado: eco };

  const { error } = await supabase.from("investigation_members").insert({
    investigation_id: id,
    user_id: userId,
    role_in_case: role,
    conflict_statement: statement,
    // A declaração e o carimbo entram juntos: uma sem a outra é meia prova.
    conflict_declared_at: new Date().toISOString(),
    added_by: author.id,
  });

  if (error) {
    const humano = error.code === "23505"
      ? "Essa pessoa já está na equipe desta investigação."
      : "Não foi possível incluir a pessoa na equipe.";
    return { ...fail("membro", error.message, humano), enviado: eco };
  }

  revalidateInvestigation(id);
  return { ok: true };
}

const removerMembroSchema = z.object({
  id: idSchema,
  user_id: z.string().regex(UUID, "Membro inválido."),
});

export async function removerMembro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = removerMembroSchema.safeParse({
    id: formData.get("id"),
    user_id: formData.get("user_id"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, user_id: userId } = parsed.data;

  const aberto = await openForWriting(id);
  if ("error" in aberto) return { error: aberto.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("investigation_members")
    .delete()
    .eq("investigation_id", id)
    .eq("user_id", userId);

  if (error) return fail("membro", error.message, "Não foi possível remover a pessoa da equipe.");

  revalidateInvestigation(id);
  return { ok: true, aviso: "Pessoa removida. Com ela sai também o acesso às denúncias vinculadas." };
}

// ── Denúncias vinculadas ─────────────────────────────────────────────────────

const vinculoSchema = z.object({
  id: idSchema,
  report_id: z.string().regex(UUID, "Escolha uma denúncia."),
});

/**
 * A relação é N:N de propósito: uma apuração pode cobrir várias denúncias
 * contra a mesma pessoa. Vincular amplia o que a equipe inteira enxerga.
 */
export async function vincularDenuncia(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = vinculoSchema.safeParse({
    id: formData.get("id"),
    report_id: formData.get("report_id"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, report_id: reportId } = parsed.data;

  const aberto = await openForWriting(id);
  if ("error" in aberto) return { error: aberto.error };

  const supabase = await createClient();
  const { count } = await supabase
    .from("investigation_reports")
    .select("report_id", { count: "exact", head: true })
    .eq("investigation_id", id);

  const { error } = await supabase.from("investigation_reports").insert({
    investigation_id: id,
    report_id: reportId,
    // A primeira a entrar é a principal; as demais são apensadas.
    is_primary: (count ?? 0) === 0,
  });

  if (error) {
    const humano = error.code === "23505"
      ? "Essa denúncia já está vinculada a esta investigação."
      : "Não foi possível vincular a denúncia.";
    return fail("vínculo", error.message, humano);
  }

  revalidateInvestigation(id);
  revalidatePath(`/admin/denuncias/${reportId}`);
  return { ok: true };
}

export async function desvincularDenuncia(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = vinculoSchema.safeParse({
    id: formData.get("id"),
    report_id: formData.get("report_id"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, report_id: reportId } = parsed.data;

  const aberto = await openForWriting(id);
  if ("error" in aberto) return { error: aberto.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("investigation_reports")
    .delete()
    .eq("investigation_id", id)
    .eq("report_id", reportId);

  if (error) return fail("vínculo", error.message, "Não foi possível desvincular a denúncia.");

  revalidateInvestigation(id);
  revalidatePath(`/admin/denuncias/${reportId}`);
  return {
    ok: true,
    aviso: "Denúncia desvinculada. A equipe da investigação deixa de enxergá-la por este caminho.",
  };
}

// ── Entrevistas ──────────────────────────────────────────────────────────────

const entrevistaSchema = z.object({
  id: idSchema,
  kind: z.enum(INTERVIEW_KIND_ORDER, { message: "Escolha quem foi entrevistado." }),
  interviewee_label: z
    .string()
    .trim()
    .min(3, "Escreva o rótulo do entrevistado.")
    .max(200, "Rótulo longo demais."),
  held_at: z.string().trim(),
  location: z.string().trim().max(300, "Local longo demais."),
  accompanied_by: z.string().trim().max(300, "Acompanhamento longo demais."),
  script: z.string().trim().max(8000, "Roteiro longo demais."),
  summary: z.string().trim().max(8000, "Resumo longo demais."),
  /**
   * Tri-estado de propósito: "1" (houve), "0" (não houve) e a ausência dos
   * dois, que é o erro. Um checkbox desmarcado e uma pergunta não respondida
   * chegam iguais ao servidor, e aqui a diferença importa.
   */
  consent_recorded: z.enum(["1", "0"], {
    message:
      "Responda se houve consentimento de gravação. A resposta é marcada por quem entrevistou, nunca presumida.",
  }),
  non_retaliation_notice_given: z.literal("1", {
    message:
      "A entrevista só pode ser registrada com a afirmação de que a pessoa foi cientificada da política de não retaliação. É exigência da Lei nº 14.457, não formalidade.",
  }),
});

/**
 * `consent_recorded` e `non_retaliation_notice_given` são afirmações, não
 * enfeites. A ciência da não retaliação é obrigatória — sem ela a entrevista
 * não se sustenta. O consentimento de gravação é opcional na forma (pode-se
 * entrevistar sem gravar) mas precisa ser uma escolha marcada, nunca um default
 * silencioso, por isso vem como par sim/não explícito na tela.
 *
 * `interviewee_label` é rótulo e não nome completo: quando o entrevistado é o
 * denunciante anônimo, escrever o nome aqui desfaz o anonimato numa tabela que
 * a equipe inteira lê.
 */
export async function registrarEntrevista(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = entrevistaSchema.safeParse({
    id: formData.get("id"),
    kind: formData.get("kind"),
    interviewee_label: text(formData, "interviewee_label"),
    held_at: text(formData, "held_at"),
    location: text(formData, "location"),
    accompanied_by: text(formData, "accompanied_by"),
    script: text(formData, "script"),
    summary: text(formData, "summary"),
    consent_recorded: formData.get("consent_recorded") ?? "",
    non_retaliation_notice_given: formData.get("non_retaliation_notice_given") ?? "",
  });
  const eco = echo(
    formData,
    "kind",
    "interviewee_label",
    "held_at",
    "location",
    "accompanied_by",
    "script",
    "summary",
  );
  eco.consent_recorded = String(formData.get("consent_recorded") ?? "");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { id } = parsed.data;

  const aberto = await openForWriting(id);
  if ("error" in aberto) return { error: aberto.error, enviado: eco };
  const { inv } = aberto;

  const author = await getAuthenticatedUser();
  if (!author) return { error: "Sessão expirada. Entre novamente.", enviado: eco };

  const heldAt = nullable(formData, "held_at");

  const supabase = await createClient();
  const { error } = await supabase.from("investigation_interviews").insert({
    investigation_id: id,
    org_id: inv.org_id,
    kind: parsed.data.kind,
    interviewee_label: parsed.data.interviewee_label,
    // `datetime-local` não manda fuso; sem o offset o Postgres lê como UTC e a
    // entrevista das 14h vira 11h na tela.
    held_at: heldAt ? `${heldAt}:00${BR_OFFSET}` : null,
    location: parsed.data.location || null,
    conducted_by: author.id,
    accompanied_by: parsed.data.accompanied_by || null,
    script: parsed.data.script || null,
    summary: parsed.data.summary || null,
    consent_recorded: parsed.data.consent_recorded === "1",
    non_retaliation_notice_given: true,
  });

  if (error) {
    return {
      ...fail("entrevista", error.message, "Não foi possível registrar a entrevista."),
      enviado: eco,
    };
  }

  revalidateInvestigation(id);
  return { ok: true };
}

// ── Achados ──────────────────────────────────────────────────────────────────

const achadoSchema = z.object({
  id: idSchema,
  statement: z
    .string()
    .trim()
    .min(15, "Escreva o achado com pelo menos 15 caracteres.")
    .max(4000, "Achado longo demais."),
  confidence: z.enum(CONFIDENCE, { message: "Escolha o grau de confiança." }),
});

/**
 * `evidence_ids` é a cadeia de custódia do achado: quais arquivos das denúncias
 * vinculadas o sustentam. Um achado sem evidência é opinião, e a tela diz isso.
 */
export async function registrarAchado(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = achadoSchema.safeParse({
    id: formData.get("id"),
    statement: text(formData, "statement"),
    confidence: formData.get("confidence"),
  });
  const eco = echo(formData, "statement", "confidence");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { id, statement, confidence } = parsed.data;

  const aberto = await openForWriting(id);
  if ("error" in aberto) return { error: aberto.error, enviado: eco };
  const { inv } = aberto;

  const author = await getAuthenticatedUser();
  if (!author) return { error: "Sessão expirada. Entre novamente.", enviado: eco };

  const evidenceIds = formData
    .getAll("evidence_ids")
    .filter((value): value is string => typeof value === "string" && UUID.test(value));

  const supabase = await createClient();

  // Contar antes de inserir mantém a ordem de leitura igual à de escrita sem
  // depender de `created_at` com resolução de microssegundo.
  const { count } = await supabase
    .from("investigation_findings")
    .select("id", { count: "exact", head: true })
    .eq("investigation_id", id);

  const { error } = await supabase.from("investigation_findings").insert({
    investigation_id: id,
    org_id: inv.org_id,
    statement,
    confidence,
    evidence_ids: evidenceIds,
    sort_order: count ?? 0,
    created_by: author.id,
  });

  if (error) {
    return { ...fail("achado", error.message, "Não foi possível registrar o achado."), enviado: eco };
  }

  revalidateInvestigation(id);
  return { ok: true };
}

// ── Conclusão e dupla assinatura ─────────────────────────────────────────────

const conclusaoSchema = z.object({
  id: idSchema,
  findings: z
    .string()
    .trim()
    .min(MIN_FINDINGS, `A síntese dos achados precisa de pelo menos ${MIN_FINDINGS} caracteres.`)
    .max(8000, "Síntese longa demais."),
  recommendation: z
    .string()
    .trim()
    .min(
      MIN_RECOMMENDATION,
      `A recomendação precisa de pelo menos ${MIN_RECOMMENDATION} caracteres.`,
    )
    .max(8000, "Recomendação longa demais."),
  outcome: z.enum(OUTCOME_ORDER, { message: "Escolha o desfecho da apuração." }),
});

/**
 * Primeiro tempo da dupla assinatura: quem conduziu escreve síntese,
 * recomendação e desfecho. NÃO toca em `status`, `concluded_at` nem
 * `reviewed_at` — a partir daqui a investigação apenas passa a exibir "pronta
 * para revisão", e é outra pessoa que a fecha.
 */
export async function salvarConclusao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = conclusaoSchema.safeParse({
    id: formData.get("id"),
    findings: text(formData, "findings"),
    recommendation: text(formData, "recommendation"),
    outcome: formData.get("outcome"),
  });
  const eco = echo(formData, "findings", "recommendation", "outcome");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };
  const { id } = parsed.data;

  const aberto = await openForWriting(id);
  if ("error" in aberto) return { error: aberto.error, enviado: eco };

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("investigations")
    .update({
      findings: parsed.data.findings,
      recommendation: parsed.data.recommendation,
      outcome: parsed.data.outcome,
      // `inv_conclusion_consistency` é uma equivalência: preencher `outcome`
      // sem `status='concluida'` só passa porque `concluded_at` segue nulo.
      // Não mexa nesta trinca fora da ação de revisar e concluir.
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ...fail("conclusão", error.message, "Não foi possível salvar a conclusão."), enviado: eco };
  }
  if (!updated || updated.length === 0) return { error: VANISHED, enviado: eco };

  revalidateInvestigation(id);
  return {
    ok: true,
    aviso:
      "Conclusão registrada. A investigação está pronta para revisão — quem a fecha é outra pessoa, nunca quem a conduziu.",
  };
}

const revisaoSchema = z.object({
  id: idSchema,
  confirmado: z.literal("1", {
    message: "Marque a afirmação de que você leu o plano, os achados e as entrevistas.",
  }),
});

/**
 * ⚠️ O UPDATE ÚNICO. A policy `inv_update` só enxerga a linha enquanto
 * `reviewed_at IS NULL`, e `inv_signoff_before_close` exige `reviewed_at` para
 * aceitar `status='concluida'`. Assinar num UPDATE e concluir noutro é
 * impossível: o segundo bateria no `USING` da própria assinatura.
 *
 * Por isso `status`, `concluded_at`, `outcome`, `reviewed_by` e `reviewed_at`
 * viajam juntos. O `USING` avalia a linha ANTIGA (ainda sem assinatura, passa)
 * e o `WITH CHECK` avalia a nova.
 *
 * Quem assina não é quem conduziu: `inv_reviewer_not_lead` garante isso no
 * banco. A tela esconde o botão para o líder, mas esconder não é impedir — se
 * o formulário voltasse por outro caminho, o CHECK recusaria com 23514.
 */
export async function revisarEConcluir(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = revisaoSchema.safeParse({
    id: formData.get("id"),
    confirmado: formData.get("confirmado") ?? "",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const aberto = await openForWriting(id);
  if ("error" in aberto) return { error: aberto.error };
  const { inv } = aberto;

  if (!inv.findings?.trim() || !inv.recommendation?.trim() || !inv.outcome) {
    return {
      error:
        "A investigação ainda não está pronta para revisão: faltam síntese dos achados, recomendação ou desfecho.",
    };
  }

  if (inv.lead_id && inv.lead_id === user.id) {
    return {
      error:
        "Quem conduziu a apuração não pode revisá-la. Peça a outra pessoa da organização que leia e assine — é o CHECK inv_reviewer_not_lead, não uma preferência de interface.",
    };
  }

  const agora = new Date().toISOString();
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("investigations")
    .update({
      status: "concluida",
      concluded_at: agora,
      outcome: inv.outcome,
      reviewed_by: user.id,
      reviewed_at: agora,
    })
    .eq("id", id)
    // O retorno não é enfeite: sem ele, uma assinatura que não pegou (0 linhas,
    // `error: null`) seria anunciada como sucesso ao usuário.
    .select("id, reviewed_at, status");

  if (error) {
    const humano =
      error.code === "23514"
        ? "O banco recusou a assinatura. Quem conduziu a apuração não pode assiná-la."
        : "Não foi possível revisar e concluir a investigação.";
    return fail("revisão", error.message, humano);
  }
  if (!updated || updated.length === 0) {
    return {
      error:
        "A assinatura não foi gravada: a investigação já havia sido assinada ou saiu do seu acesso. Recarregue a página antes de tentar de novo.",
    };
  }

  revalidateInvestigation(id);
  return { ok: true };
}
