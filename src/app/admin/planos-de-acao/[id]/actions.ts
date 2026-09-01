"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getStaffContext } from "@/lib/org/context";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { addDaysOnly, todayInSaoPaulo } from "@/lib/admin/labels";
import {
  KIND_ORDER,
  PLAN_PATH,
  SELECTABLE_PLAN_STATUS,
  SELECTABLE_STATUS,
  UUID,
  VERDICT_ORDER,
  VERIFY_DEFAULT_DAYS,
  decodeOrigem,
} from "@/lib/admin/planos";

/**
 * Mutações do plano de ação e das suas medidas de prevenção e controle. Todas
 * rodam sob RLS (`createClient`): quem autoriza é `plans_insert`/`plans_update`
 * e `measures_insert`/`measures_update` (admin e investigador), nunca um `if`
 * de papel aqui.
 *
 * Nenhuma grava auditoria. Os triggers `t_plans_audit` e `t_measures_audit`
 * (migração 024) emitem `plan.created`, `plan.status_changed`, `plan.closed`,
 * `measure.created`, `measure.completed`, `measure.overdue` e
 * `measure.verified` na MESMA transação da mutação — e emitem só código,
 * chaves e enums, nunca o texto da medida, das notas de conclusão ou da
 * verificação. Repetir em JS duplicaria linha numa tabela imutável por RULE.
 *
 * Três regras do banco moldam este arquivo inteiro:
 *
 * 1. `measure_completion_consistency` — `status='concluida'` ⟺ `completed_at`
 *    preenchido. O par viaja sempre no mesmo `.update({...})`.
 * 2. `measure_verification_consistency` — `effectiveness <> 'nao_verificada'`
 *    ⟺ `verified_at` preenchido. Idem.
 * 3. `measure_verifier_not_owner` — `verified_by <> owner_id`. Quem executou
 *    não verifica; a tela esconde o controle e o CHECK recusa com 23514 se
 *    alguém chegar por outro caminho.
 *
 * E `atrasada` não é escrita por nenhuma ação daqui. Quem a marca é
 * `public.sweep_overdue()`, chamada pelo cron.
 *
 * ⚠️ Armadilha do PostgREST, a mesma do módulo de investigações: quando a
 * policy esconde a linha, o UPDATE não levanta erro — ele afeta ZERO linhas e
 * devolve `error: null`. Todo update aqui pede `.select("id")` de volta e trata
 * a lista vazia como recusa explícita.
 */

export type ActionState = {
  ok?: true;
  error?: string;
  aviso?: string;
  /**
   * Eco do que foi digitado. O React limpa um `<form action=…>` assim que a
   * ação termina — inclusive quando ela recusou. Sem devolver o texto, o
   * critério de eficácia inteiro evaporaria por causa de um campo faltando.
   */
  enviado?: Record<string, string>;
};

const idSchema = z.string().regex(UUID, "Plano inválido.");
const measureIdSchema = z.string().regex(UUID, "Medida inválida.");

const MIN_TITLE = 10;
const MIN_DESCRIPTION = 20;
const MIN_CRITERIA = 20;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
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
  console.error("[plano de ação] %s: %s", escopo, message);
  return { error: humano };
}

function revalidatePlan(id: string) {
  revalidatePath(`${PLAN_PATH}/${id}`);
  revalidatePath(PLAN_PATH);
  revalidatePath("/admin", "layout");
}

/** Zero linhas afetadas não é sucesso: é a RLS recusando em silêncio. */
const VANISHED =
  "Nada foi gravado: o plano saiu do seu alcance de escrita entre abrir a tela e salvar. Recarregue a página.";

const MEASURE_VANISHED =
  "Nada foi gravado: a medida saiu do seu alcance de escrita entre abrir a tela e salvar. Recarregue a página.";

/**
 * Lê o plano sob RLS. Voltar vazio já é a resposta de autorização: quem não
 * pode ver não pode mudar, e é a política que decide isso.
 */
async function loadPlan(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("action_plans")
    .select(
      "id, org_id, code, status, title, risk_source, report_id, investigation_id, owner_id, starts_on, due_on",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Lê a medida sob RLS, já com o plano a que pertence. */
async function loadMeasure(measureId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("action_measures")
    .select(
      "id, org_id, action_plan_id, status, effectiveness, effectiveness_criteria, owner_id, due_on, verify_on, completed_at",
    )
    .eq("id", measureId)
    .maybeSingle();
  return data;
}

/**
 * `action_plans.code` é NOT NULL e sem default: quem gera é
 * `app.next_code(org, 'PA')`, que devolve `PA-2026-0001` numa sequência por
 * organização (UNIQUE `(org_id, code)`). Gerar o número em JS abriria corrida
 * entre dois usuários salvando ao mesmo tempo.
 *
 * `app.next_code` mora no schema `app`, que o PostgREST não expõe; quem atende
 * a chamada é o wrapper `public.next_code` da migração 025, que confere o
 * vínculo com a organização (42501 se não houver) antes de delegar.
 */
async function nextPlanCode(orgId: string) {
  const supabase = await createClient();
  return supabase.rpc("next_code", { p_org: orgId, p_prefix: "PA" });
}

const CODE_FAILED =
  "Não foi possível gerar o código do plano. A função app.next_code (migração 024) e o wrapper public.next_code (migração 025) precisam estar aplicados.";

// ── Abertura do plano ────────────────────────────────────────────────────────

const criarSchema = z.object({
  title: z
    .string()
    .trim()
    .min(MIN_TITLE, "Dê ao plano um título de pelo menos 10 caracteres.")
    .max(300, "Título longo demais."),
  /** `risk_source:uuid?` — ver `decodeOrigem`. */
  origem: z.string().trim().min(1, "Escolha a origem do risco."),
  owner_id: z.union([z.string().regex(UUID), z.literal("")]),
  rationale: z
    .string()
    .trim()
    .min(20, "Escreva a justificativa com pelo menos 20 caracteres.")
    .max(4000, "Justificativa longa demais."),
  starts_on: z.string().trim(),
  due_on: z.string().trim(),
});

const ECO_PLANO = ["title", "origem", "owner_id", "rationale", "starts_on", "due_on"] as const;

/**
 * A justificativa é obrigatória desde o primeiro minuto: um plano de ação sem
 * o porquê é uma lista de tarefas, e é o porquê que liga a medida ao fator de
 * risco na hora da fiscalização.
 */
export async function criarPlano(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = criarSchema.safeParse({
    title: text(formData, "title"),
    origem: text(formData, "origem"),
    owner_id: formData.get("owner_id") ?? "",
    rationale: text(formData, "rationale"),
    starts_on: text(formData, "starts_on"),
    due_on: text(formData, "due_on"),
  });
  const eco = echo(formData, ...ECO_PLANO);
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const { title, rationale } = parsed.data;
  const ownerId = parsed.data.owner_id || null;
  const startsOn = parsed.data.starts_on || null;
  const dueOn = parsed.data.due_on || null;

  // `action_plans_check`: due_on >= starts_on. Recusar aqui devolve uma frase
  // em português em vez do 23514 cru.
  if (startsOn && dueOn && dueOn < startsOn) {
    return { error: "O prazo não pode ser anterior ao início do plano.", enviado: eco };
  }

  // A origem é um campo só na tela e três colunas no banco. `decodeOrigem`
  // é quem as separa, e recusar aqui impede um plano que diz vir de uma
  // denúncia e aponta para uma investigação.
  const origem = decodeOrigem(parsed.data.origem);
  if (!origem) return { error: "Origem inválida.", enviado: eco };
  const { source: riskSource, reportId, investigationId } = origem;

  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente.", enviado: eco };
  const staff = await getStaffContext();

  const { data: code, error: codeError } = await nextPlanCode(staff.orgId);
  if (codeError || !code) {
    return {
      ...fail("código", codeError?.message ?? "next_code devolveu vazio", CODE_FAILED),
      enviado: eco,
    };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("action_plans")
    .insert({
      org_id: staff.orgId,
      code,
      title,
      rationale,
      risk_source: riskSource,
      report_id: reportId,
      investigation_id: investigationId,
      owner_id: ownerId,
      starts_on: startsOn,
      due_on: dueOn,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    return {
      ...fail(
        "criação",
        error?.message ?? "insert sem retorno",
        "Não foi possível abrir o plano de ação.",
      ),
      enviado: eco,
    };
  }

  revalidatePlan(created.id);
  redirect(`${PLAN_PATH}/${created.id}`);
}

// ── Plano ────────────────────────────────────────────────────────────────────

const planoSchema = z.object({
  id: idSchema,
  title: z
    .string()
    .trim()
    .min(MIN_TITLE, "Dê ao plano um título de pelo menos 10 caracteres.")
    .max(300, "Título longo demais."),
  origem: z.string().trim().min(1, "Escolha a origem do risco."),
  rationale: z.string().trim().max(4000, "Justificativa longa demais."),
  owner_id: z.union([z.string().regex(UUID), z.literal("")]),
  starts_on: z.string().trim(),
  due_on: z.string().trim(),
  status: z.enum(SELECTABLE_PLAN_STATUS, { message: "Selecione uma situação válida." }),
});

export async function salvarPlano(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = planoSchema.safeParse({
    id: formData.get("id"),
    title: text(formData, "title"),
    origem: text(formData, "origem"),
    rationale: text(formData, "rationale"),
    owner_id: formData.get("owner_id") ?? "",
    starts_on: text(formData, "starts_on"),
    due_on: text(formData, "due_on"),
    status: formData.get("status"),
  });
  const eco = echo(formData, "title", "origem", "rationale", "owner_id", "starts_on", "due_on", "status");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const { id, status } = parsed.data;
  const ownerId = parsed.data.owner_id || null;
  const startsOn = parsed.data.starts_on || null;
  const dueOn = parsed.data.due_on || null;

  if (startsOn && dueOn && dueOn < startsOn) {
    return { error: "O prazo não pode ser anterior ao início do plano.", enviado: eco };
  }

  const origem = decodeOrigem(parsed.data.origem);
  if (!origem) return { error: "Origem inválida.", enviado: eco };

  const plan = await loadPlan(id);
  if (!plan) return { error: "Plano não encontrado ou fora do seu acesso.", enviado: eco };

  const supabase = await createClient();
  if (ownerId) {
    const { data: member } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("user_id", ownerId)
      .eq("org_id", plan.org_id)
      .eq("status", "active")
      .maybeSingle();
    if (!member) {
      return { error: "Essa pessoa não é membro ativo desta organização.", enviado: eco };
    }
  }

  const { data: updated, error } = await supabase
    .from("action_plans")
    .update({
      title: parsed.data.title,
      risk_source: origem.source,
      report_id: origem.reportId,
      investigation_id: origem.investigationId,
      rationale: parsed.data.rationale || null,
      owner_id: ownerId,
      starts_on: startsOn,
      due_on: dueOn,
      status,
      // `closed_at` não tem CHECK que o amarre ao status, mas deixá-lo
      // desalinhado tornaria o relatório da Fase 6 mentiroso. Fecha e reabre
      // junto com a situação.
      closed_at: status === "concluida" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return { ...fail("plano", error.message, "Não foi possível salvar o plano."), enviado: eco };
  }
  if (!updated || updated.length === 0) return { error: VANISHED, enviado: eco };

  revalidatePlan(id);
  return { ok: true };
}

// ── Medidas de prevenção e controle ──────────────────────────────────────────

const medidaSchema = z.object({
  id: idSchema,
  description: z
    .string()
    .trim()
    .min(
      MIN_DESCRIPTION,
      "Descreva a medida com pelo menos 20 caracteres — o que será feito, não a intenção.",
    )
    .max(4000, "Descrição longa demais."),
  kind: z.enum(KIND_ORDER, { message: "Escolha o tipo da medida." }),
  category_id: z
    .string()
    .regex(UUID, "Escolha o fator de risco associado — é ele que liga a medida ao PGR."),
  owner_id: z.union([z.string().regex(UUID), z.literal("")]),
  org_unit_id: z.union([z.string().regex(UUID), z.literal("")]),
  due_on: z.string().trim(),
  effectiveness_criteria: z
    .string()
    .trim()
    .min(
      MIN_CRITERIA,
      "Escreva o critério de eficácia agora, com pelo menos 20 caracteres. Critério definido depois do resultado é justificativa, não verificação.",
    )
    .max(2000, "Critério longo demais."),
});

const ECO_MEDIDA = [
  "description",
  "kind",
  "category_id",
  "owner_id",
  "org_unit_id",
  "due_on",
  "effectiveness_criteria",
] as const;

/**
 * O `category_id` é obrigatório aqui, embora seja anulável no banco. É o
 * **fator de risco associado**: sem ele não existe "% de fatores de risco com
 * plano ativo", que é o número que diz se o PGR é real ou é papel.
 *
 * O `effectiveness_criteria` também é obrigatório, e obrigatório AGORA. Um
 * critério escrito depois de ver o resultado não verifica nada — descreve o que
 * aconteceu e chama de sucesso. Escrevê-lo na criação é a única forma de a
 * verificação significar alguma coisa.
 */
export async function criarMedida(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = medidaSchema.safeParse({
    id: formData.get("id"),
    description: text(formData, "description"),
    kind: formData.get("kind"),
    category_id: text(formData, "category_id"),
    owner_id: formData.get("owner_id") ?? "",
    org_unit_id: formData.get("org_unit_id") ?? "",
    due_on: text(formData, "due_on"),
    effectiveness_criteria: text(formData, "effectiveness_criteria"),
  });
  const eco = echo(formData, ...ECO_MEDIDA);
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const { id } = parsed.data;
  const plan = await loadPlan(id);
  if (!plan) return { error: "Plano não encontrado ou fora do seu acesso.", enviado: eco };

  const supabase = await createClient();

  // Contar antes de inserir mantém a ordem de leitura igual à de escrita sem
  // depender de `created_at` com resolução de microssegundo.
  const { count } = await supabase
    .from("action_measures")
    .select("id", { count: "exact", head: true })
    .eq("action_plan_id", id);

  const { error } = await supabase.from("action_measures").insert({
    action_plan_id: id,
    // `org_id` é NOT NULL e é o que a policy `measures_insert` avalia: tem que
    // ser o do plano, não o do usuário, ou uma medida acabaria noutra org.
    org_id: plan.org_id,
    description: parsed.data.description,
    kind: parsed.data.kind,
    category_id: parsed.data.category_id,
    owner_id: parsed.data.owner_id || null,
    org_unit_id: parsed.data.org_unit_id || null,
    due_on: parsed.data.due_on || null,
    effectiveness_criteria: parsed.data.effectiveness_criteria,
    sort_order: count ?? 0,
  });

  if (error) {
    return {
      ...fail("medida", error.message, "Não foi possível registrar a medida."),
      enviado: eco,
    };
  }

  revalidatePlan(id);
  return { ok: true };
}

const atualizarSchema = medidaSchema.extend({
  medida_id: measureIdSchema,
  status: z.enum(SELECTABLE_STATUS, {
    message:
      "Situação inválida. “Atrasada” é marcada pelo sistema e “Concluída” tem ação própria.",
  }),
});

/**
 * Edita uma medida que ainda não foi verificada. `status` aceita só
 * `SELECTABLE_STATUS` — sem `atrasada` (é do `sweep_overdue`) e sem `concluida`
 * (exige `completed_at` no mesmo UPDATE, logo tem ação própria). Como nenhum
 * dos valores aceitos é `concluida`, `completed_at` volta a nulo junto, que é o
 * que `measure_completion_consistency` exige de quem reabre uma medida.
 */
export async function atualizarMedida(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = atualizarSchema.safeParse({
    id: formData.get("id"),
    medida_id: formData.get("medida_id"),
    description: text(formData, "description"),
    kind: formData.get("kind"),
    category_id: text(formData, "category_id"),
    owner_id: formData.get("owner_id") ?? "",
    org_unit_id: formData.get("org_unit_id") ?? "",
    due_on: text(formData, "due_on"),
    effectiveness_criteria: text(formData, "effectiveness_criteria"),
    status: formData.get("status"),
  });
  const eco = echo(formData, ...ECO_MEDIDA, "status");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const { id, medida_id: measureId, status } = parsed.data;

  const measure = await loadMeasure(measureId);
  if (!measure || measure.action_plan_id !== id) {
    return { error: "Medida não encontrada ou fora do seu acesso.", enviado: eco };
  }
  if (measure.effectiveness !== "nao_verificada") {
    return {
      error:
        "Esta medida já foi verificada quanto à eficácia. Reescrevê-la agora apagaria o critério contra o qual ela foi julgada — abra uma medida nova ou um plano de follow-up.",
      enviado: eco,
    };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("action_measures")
    .update({
      description: parsed.data.description,
      kind: parsed.data.kind,
      category_id: parsed.data.category_id,
      owner_id: parsed.data.owner_id || null,
      org_unit_id: parsed.data.org_unit_id || null,
      due_on: parsed.data.due_on || null,
      effectiveness_criteria: parsed.data.effectiveness_criteria,
      status,
      // O par de `measure_completion_consistency` viaja junto, sempre.
      completed_at: null,
      completion_notes: null,
    })
    .eq("id", measureId)
    .select("id");

  if (error) {
    return { ...fail("medida", error.message, "Não foi possível salvar a medida."), enviado: eco };
  }
  if (!updated || updated.length === 0) return { error: MEASURE_VANISHED, enviado: eco };

  revalidatePlan(id);
  return { ok: true };
}

const concluirSchema = z.object({
  id: idSchema,
  medida_id: measureIdSchema,
  completion_notes: z
    .string()
    .trim()
    .min(10, "Diga em uma linha o que foi efetivamente implantado.")
    .max(4000, "Notas longas demais."),
  verify_on: z.string().trim(),
});

/**
 * Concluir a medida. `status='concluida'` e `completed_at` no MESMO update —
 * `measure_completion_consistency` é uma equivalência, e gravar um sem o outro
 * é 23514 na certa.
 *
 * A data de verificação é agendada aqui, não depois: é o momento em que se sabe
 * quando o efeito poderá ser medido. A sugestão é hoje + 30 dias, e o campo é
 * editável — trinta dias é um bom padrão, não uma regra da norma.
 */
export async function concluirMedida(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = concluirSchema.safeParse({
    id: formData.get("id"),
    medida_id: formData.get("medida_id"),
    completion_notes: text(formData, "completion_notes"),
    verify_on: text(formData, "verify_on"),
  });
  const eco = echo(formData, "completion_notes", "verify_on");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const { id, medida_id: measureId } = parsed.data;
  const measure = await loadMeasure(measureId);
  if (!measure || measure.action_plan_id !== id) {
    return { error: "Medida não encontrada ou fora do seu acesso.", enviado: eco };
  }
  if (measure.status === "concluida") {
    return { error: "Esta medida já está concluída.", enviado: eco };
  }
  if (!measure.effectiveness_criteria?.trim()) {
    return {
      error:
        "Esta medida não tem critério de eficácia escrito. Escreva o critério antes de concluí-la — depois do resultado ele não verifica mais nada.",
      enviado: eco,
    };
  }

  const today = todayInSaoPaulo();
  const verifyOn = parsed.data.verify_on || addDaysOnly(today, VERIFY_DEFAULT_DAYS);
  if (verifyOn < today) {
    return {
      error: "A verificação de eficácia não pode ser agendada para uma data passada.",
      enviado: eco,
    };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("action_measures")
    .update({
      status: "concluida",
      // O par que `measure_completion_consistency` exige.
      completed_at: new Date().toISOString(),
      completion_notes: parsed.data.completion_notes,
      verify_on: verifyOn,
    })
    .eq("id", measureId)
    .select("id");

  if (error) {
    const humano =
      error.code === "23514"
        ? "O banco recusou a conclusão: status e data de conclusão precisam ser gravados juntos."
        : "Não foi possível concluir a medida.";
    return { ...fail("conclusão", error.message, humano), enviado: eco };
  }
  if (!updated || updated.length === 0) return { error: MEASURE_VANISHED, enviado: eco };

  revalidatePlan(id);
  return {
    ok: true,
    aviso:
      "Medida concluída. A verificação de eficácia foi agendada — quem a fizer não pode ser quem a executou.",
  };
}

const agendarSchema = z.object({
  id: idSchema,
  medida_id: measureIdSchema,
  verify_on: z.string().trim().min(1, "Escolha a data da verificação."),
});

/** Reagendar a verificação. Não toca em status nem em `effectiveness`. */
export async function agendarVerificacao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = agendarSchema.safeParse({
    id: formData.get("id"),
    medida_id: formData.get("medida_id"),
    verify_on: text(formData, "verify_on"),
  });
  const eco = echo(formData, "verify_on");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const { id, medida_id: measureId, verify_on: verifyOn } = parsed.data;
  const measure = await loadMeasure(measureId);
  if (!measure || measure.action_plan_id !== id) {
    return { error: "Medida não encontrada ou fora do seu acesso.", enviado: eco };
  }
  if (measure.effectiveness !== "nao_verificada") {
    return { error: "Esta medida já foi verificada.", enviado: eco };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("action_measures")
    .update({ verify_on: verifyOn })
    .eq("id", measureId)
    .select("id");

  if (error) {
    return {
      ...fail("agendamento", error.message, "Não foi possível agendar a verificação."),
      enviado: eco,
    };
  }
  if (!updated || updated.length === 0) return { error: MEASURE_VANISHED, enviado: eco };

  revalidatePlan(id);
  return { ok: true };
}

const verificarSchema = z.object({
  id: idSchema,
  medida_id: measureIdSchema,
  effectiveness: z.enum(VERDICT_ORDER, { message: "Escolha o resultado da verificação." }),
  verification_notes: z
    .string()
    .trim()
    .min(
      20,
      "Escreva o que foi observado, com pelo menos 20 caracteres, à luz do critério definido quando a medida foi criada.",
    )
    .max(4000, "Notas de verificação longas demais."),
  confirmado: z.literal("1", {
    message: "Marque a afirmação de que você não executou esta medida.",
  }),
});

/**
 * A verificação de eficácia — a etapa que todo mundo pula e todo auditor
 * pergunta.
 *
 * `effectiveness` e `verified_at` viajam no mesmo `.update({...})` porque
 * `measure_verification_consistency` é uma equivalência. `verified_by` entra
 * junto e o CHECK `measure_verifier_not_owner` recusa (23514) se for igual ao
 * `owner_id`. A recusa abaixo existe para dar a frase em português; quem
 * garante é o banco.
 */
export async function verificarMedida(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = verificarSchema.safeParse({
    id: formData.get("id"),
    medida_id: formData.get("medida_id"),
    effectiveness: formData.get("effectiveness"),
    verification_notes: text(formData, "verification_notes"),
    confirmado: formData.get("confirmado") ?? "",
  });
  const eco = echo(formData, "effectiveness", "verification_notes");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const { id, medida_id: measureId } = parsed.data;

  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente.", enviado: eco };

  const measure = await loadMeasure(measureId);
  if (!measure || measure.action_plan_id !== id) {
    return { error: "Medida não encontrada ou fora do seu acesso.", enviado: eco };
  }
  if (measure.status !== "concluida") {
    return {
      error:
        "Só se verifica a eficácia de uma medida concluída. Verificar antes é opinar sobre o que ainda não foi feito.",
      enviado: eco,
    };
  }
  if (measure.effectiveness !== "nao_verificada") {
    return { error: "Esta medida já foi verificada.", enviado: eco };
  }
  if (measure.owner_id && measure.owner_id === user.id) {
    return {
      error:
        "Quem executou a medida não pode verificá-la. É o CHECK measure_verifier_not_owner, não uma preferência de interface: peça a outra pessoa da organização que confira o resultado contra o critério.",
      enviado: eco,
    };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("action_measures")
    .update({
      effectiveness: parsed.data.effectiveness,
      // O par que `measure_verification_consistency` exige.
      verified_at: new Date().toISOString(),
      verified_by: user.id,
      verification_notes: parsed.data.verification_notes,
    })
    .eq("id", measureId)
    .select("id");

  if (error) {
    const humano =
      error.code === "23514"
        ? "O banco recusou a verificação. Quem executou a medida não pode verificá-la."
        : "Não foi possível registrar a verificação.";
    return { ...fail("verificação", error.message, humano), enviado: eco };
  }
  if (!updated || updated.length === 0) return { error: MEASURE_VANISHED, enviado: eco };

  revalidatePlan(id);
  return {
    ok: true,
    aviso:
      parsed.data.effectiveness === "eficaz"
        ? "Verificação registrada. A medida entra na contagem de eficazes do plano."
        : "Verificação registrada. Medida que não atingiu o critério pede um plano de follow-up — a oferta está logo abaixo dela.",
  };
}

const excluirSchema = z.object({ id: idSchema, medida_id: measureIdSchema });

/**
 * DELETE de medida é só de `admin` (policy `measures_delete`). A tela esconde o
 * botão para os demais, mas quem recusa é a política: sem linha afetada, a
 * ação avisa em vez de mentir que apagou.
 */
export async function excluirMedida(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = excluirSchema.safeParse({
    id: formData.get("id"),
    medida_id: formData.get("medida_id"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, medida_id: measureId } = parsed.data;

  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("action_measures")
    .delete()
    .eq("id", measureId)
    .eq("action_plan_id", id)
    .select("id");

  if (error) return fail("exclusão", error.message, "Não foi possível excluir a medida.");
  if (!removed || removed.length === 0) {
    return {
      error:
        "Nada foi excluído: apagar medida é permissão de administração (policy measures_delete).",
    };
  }

  revalidatePlan(id);
  return { ok: true, aviso: "Medida excluída. A trilha de auditoria da criação dela permanece." };
}

// ── Follow-up ────────────────────────────────────────────────────────────────

const followUpSchema = z.object({
  id: idSchema,
  medida_id: measureIdSchema,
  title: z
    .string()
    .trim()
    .min(MIN_TITLE, "Dê ao plano de follow-up um título de pelo menos 10 caracteres.")
    .max(300, "Título longo demais."),
  due_on: z.string().trim(),
});

/**
 * O fecho do ciclo da NR-01: medida verificada como ineficaz ou parcialmente
 * eficaz não termina em "implantado". Abre-se um plano novo, já ligado à MESMA
 * origem (a denúncia ou a investigação que gerou o primeiro), para que a
 * cadeia risco → medida → verificação → nova medida fique legível.
 */
export async function criarPlanoDeFollowUp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = followUpSchema.safeParse({
    id: formData.get("id"),
    medida_id: formData.get("medida_id"),
    title: text(formData, "title"),
    due_on: text(formData, "due_on"),
  });
  const eco = echo(formData, "title", "due_on");
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const { id, medida_id: measureId } = parsed.data;

  const [plan, measure] = await Promise.all([loadPlan(id), loadMeasure(measureId)]);
  if (!plan) return { error: "Plano não encontrado ou fora do seu acesso.", enviado: eco };
  if (!measure || measure.action_plan_id !== id) {
    return { error: "Medida não encontrada ou fora do seu acesso.", enviado: eco };
  }
  if (measure.effectiveness === "nao_verificada" || measure.effectiveness === "eficaz") {
    return {
      error: "O follow-up só se abre para medida verificada como ineficaz ou parcialmente eficaz.",
      enviado: eco,
    };
  }

  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente.", enviado: eco };

  const { data: code, error: codeError } = await nextPlanCode(plan.org_id);
  if (codeError || !code) {
    return {
      ...fail("código", codeError?.message ?? "next_code devolveu vazio", CODE_FAILED),
      enviado: eco,
    };
  }

  const today = todayInSaoPaulo();
  const dueOn = parsed.data.due_on || null;
  if (dueOn && dueOn < today) {
    return { error: "O prazo do follow-up não pode ser uma data passada.", enviado: eco };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("action_plans")
    .insert({
      org_id: plan.org_id,
      code,
      title: parsed.data.title,
      // A justificativa cita códigos e o veredito, nunca a descrição da medida
      // nem as notas de verificação — o mesmo critério dos triggers.
      rationale: `Plano de follow-up do ${plan.code}: uma medida daquele plano foi verificada e o resultado foi “${measure.effectiveness}”. A NR-01 não aceita medida verificada como insuficiente sem novo tratamento do fator de risco.`,
      // Mesma origem do plano anterior: é o que fecha o ciclo.
      risk_source: plan.risk_source,
      report_id: plan.report_id,
      investigation_id: plan.investigation_id,
      starts_on: today,
      due_on: dueOn,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    return {
      ...fail(
        "follow-up",
        error?.message ?? "insert sem retorno",
        "Não foi possível abrir o plano de follow-up.",
      ),
      enviado: eco,
    };
  }

  revalidatePlan(id);
  revalidatePlan(created.id);
  redirect(`${PLAN_PATH}/${created.id}`);
}
