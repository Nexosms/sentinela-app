"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getStaffContext } from "@/lib/org/context";
import { createClient } from "@/lib/supabase/server";
import {
  MIN_CELL_SIZE_FLOOR,
  SETTINGS_PATH,
  TIMEZONE_VALUES,
  UFS,
  UUID,
  isValidCnpj,
  isValidDocumento,
  onlyDigits,
  slugifyCode,
} from "@/lib/admin/configuracoes";
import { CONFIGURABLE_NAV_ITEMS } from "@/lib/admin/navItems";

/**
 * Mutações de Configurações. Todas rodam sob RLS (`createClient`): quem
 * autoriza são `org_update`, `units_insert`/`units_update`,
 * `categories_insert`/`categories_update` e `members_update` — todas exigindo
 * `app.has_role(org, {admin})`. Nenhum `if (role === "admin")` aqui decide
 * acesso; o que a tela esconde, esconde por cortesia.
 *
 * Nenhuma grava auditoria em JS. Os triggers `t_org_settings_audit` e
 * `t_org_member_audit` (migração 027) emitem `settings.changed`,
 * `invite.sent`, `member.role_changed`, `member.suspended` e
 * `member.reactivated` na MESMA transação da mutação. `audit_events` não
 * aceita INSERT de `authenticated` e `app.write_audit` não é alcançável pelo
 * PostgREST — repetir em JS não seria só duplicação, seria impossível.
 *
 * ⚠️ Armadilha do PostgREST (README): UPDATE barrado por RLS afeta ZERO linhas
 * e devolve `error: null`. Todo update aqui pede `.select("id")` de volta e
 * trata a lista vazia como recusa explícita.
 */

export type ActionState = {
  ok?: true;
  error?: string;
  aviso?: string;
  /** Eco do digitado: o React limpa o `<form action=…>` mesmo quando recusa. */
  enviado?: Record<string, string>;
};

const OK: ActionState = { ok: true };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function echo(formData: FormData, ...names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") out[name] = value;
    else if (value === null) out[name] = "";
  }
  return out;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

function fail(escopo: string, message: string, humano: string): ActionState {
  console.error("[configurações] %s: %s", escopo, message);
  return { error: humano };
}

/**
 * `revalidatePath("/admin", "layout")` é o que faz o nome novo da organização
 * aparecer na barra lateral: o `trade_name` é lido em `admin/layout.tsx`, e sem
 * invalidar o layout inteiro a sidebar continuaria mostrando o nome antigo até
 * o próximo recarregamento completo.
 */
function revalidateSettings() {
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/admin", "layout");
}

const VANISHED =
  "Nada foi gravado: a linha saiu do seu alcance de escrita entre abrir a tela e salvar. Recarregue a página.";

// ── Organização ──────────────────────────────────────────────────────────────

const organizacaoSchema = z.object({
  legal_name: z
    .string()
    .trim()
    .min(3, "Informe a razão social.")
    .max(200, "Razão social longa demais."),
  trade_name: z
    .string()
    .trim()
    .min(2, "Informe o nome que a equipe vê na barra lateral.")
    .max(120, "Nome fantasia longo demais."),
  cnpj: z.string().trim(),
  timezone: z.enum(TIMEZONE_VALUES as [string, ...string[]], "Escolha um fuso da lista."),
  sla_triagem_hours: z
    .number()
    .int("Informe o prazo em horas inteiras.")
    .min(1, "O prazo de triagem precisa ser de pelo menos 1 hora.")
    .max(8760, "Prazo de triagem irreal (máximo de um ano)."),
  sla_apuracao_hours: z
    .number()
    .int("Informe o prazo em horas inteiras.")
    .min(1, "O prazo de apuração precisa ser de pelo menos 1 hora.")
    .max(8760, "Prazo de apuração irreal (máximo de um ano)."),
  retention_months: z
    .number()
    .int("Informe a retenção em meses inteiros.")
    // `organizations_retention_months_check`: >= 12.
    .min(12, "A retenção mínima é de 12 meses.")
    .max(240, "Retenção acima de 20 anos não se sustenta na LGPD."),
  min_cell_size: z
    .number()
    .int("Informe o limiar em números inteiros.")
    .min(
      MIN_CELL_SIZE_FLOOR,
      `O limiar de supressão não pode ser menor que ${MIN_CELL_SIZE_FLOOR}. Abaixo disso um relatório com uma célula de 1 ou 2 pessoas aponta para quem denunciou.`,
    )
    .max(100, "Limiar alto demais: o relatório ficaria vazio."),
});

const ECO_ORG = [
  "legal_name",
  "trade_name",
  "cnpj",
  "timezone",
  "sla_triagem_hours",
  "sla_apuracao_hours",
  "retention_months",
  "min_cell_size",
] as const;

/** Campo numérico vazio vira NaN de propósito: o zod recusa com a frase certa. */
function num(formData: FormData, name: string): number {
  const value = text(formData, name);
  return value === "" ? Number.NaN : Number(value);
}

export async function salvarOrganizacao(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const eco = echo(formData, ...ECO_ORG);
  const parsed = organizacaoSchema.safeParse({
    legal_name: text(formData, "legal_name"),
    trade_name: text(formData, "trade_name"),
    cnpj: text(formData, "cnpj"),
    timezone: text(formData, "timezone"),
    sla_triagem_hours: num(formData, "sla_triagem_hours"),
    sla_apuracao_hours: num(formData, "sla_apuracao_hours"),
    retention_months: num(formData, "retention_months"),
    min_cell_size: num(formData, "min_cell_size"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  // O banco aceita CPF (11 dígitos) ou CNPJ/CAEPF (14) — `organizations_cnpj_check`.
  // Quem digita cola com pontuação; limpar e conferir aqui evita o 23514 cru.
  const digits = onlyDigits(parsed.data.cnpj);
  if (digits !== "" && !isValidDocumento(digits)) {
    return {
      error: "Documento inválido. Confira o CPF, CNPJ ou CAEPF digitado.",
      enviado: eco,
    };
  }

  const staff = await getStaffContext();
  const supabase = await createClient();

  // Estado anterior, para dizer o que mudou — e sobretudo para avisar quando o
  // limiar de supressão CAI, que é a única mudança desta tela com efeito sobre
  // reidentificação.
  const { data: before } = await supabase
    .from("organizations")
    .select("min_cell_size, trade_name")
    .eq("id", staff.orgId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("organizations")
    .update({
      legal_name: parsed.data.legal_name,
      trade_name: parsed.data.trade_name,
      cnpj: digits === "" ? null : digits,
      timezone: parsed.data.timezone,
      sla_triagem_hours: parsed.data.sla_triagem_hours,
      sla_apuracao_hours: parsed.data.sla_apuracao_hours,
      retention_months: parsed.data.retention_months,
      min_cell_size: parsed.data.min_cell_size,
    })
    .eq("id", staff.orgId)
    .select("id");

  if (error) {
    // 23505 é o UNIQUE de CNPJ: outra organização já usa esse número.
    if (error.code === "23505") {
      return { error: "Esse CNPJ já está cadastrado em outra organização.", enviado: eco };
    }
    return { ...fail("salvar organização", error.message, "Não foi possível salvar."), enviado: eco };
  }
  if (!data || data.length === 0) return { error: VANISHED, enviado: eco };

  revalidateSettings();

  const antes = before?.min_cell_size ?? null;
  const depois = parsed.data.min_cell_size;
  const avisos: string[] = [];
  if (antes !== null && depois < antes) {
    avisos.push(
      `O limiar de supressão caiu de ${antes} para ${depois}. A partir de agora os relatórios passam a mostrar células com até ${antes - 1} ocorrências — em unidades pequenas isso pode apontar para quem denunciou. A mudança ficou registrada na trilha de auditoria com os dois valores.`,
    );
  }
  if (before && before.trade_name !== parsed.data.trade_name) {
    avisos.push(`A barra lateral passa a exibir "${parsed.data.trade_name}".`);
  }

  return avisos.length > 0 ? { ok: true, aviso: avisos.join(" ") } : OK;
}

// ── Unidades ─────────────────────────────────────────────────────────────────

const unidadeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Informe um código curto para a unidade (ex.: MATRIZ, FIL-SP).")
    .max(40, "Código longo demais."),
  name: z.string().trim().min(2, "Informe o nome da unidade.").max(150, "Nome longo demais."),
  city: z.string().trim().max(120, "Cidade longa demais."),
  state_uf: z.union([z.enum(UFS as [string, ...string[]], "UF inválida."), z.literal("")]),
  cnpj: z.string().trim(),
  headcount: z.union([z.number().int().min(0, "Efetivo não pode ser negativo."), z.nan()]),
  sort_order: z.union([z.number().int(), z.nan()]),
});

const ECO_UNIDADE = ["code", "name", "city", "state_uf", "cnpj", "headcount", "sort_order"] as const;

function parseUnidade(formData: FormData) {
  return unidadeSchema.safeParse({
    code: text(formData, "code"),
    name: text(formData, "name"),
    city: text(formData, "city"),
    state_uf: text(formData, "state_uf").toUpperCase(),
    cnpj: text(formData, "cnpj"),
    headcount: num(formData, "headcount"),
    sort_order: num(formData, "sort_order"),
  });
}

type UnidadeCampos = {
  code: string;
  name: string;
  city: string | null;
  state_uf: string | null;
  cnpj: string | null;
  headcount: number | null;
  sort_order: number;
};

function unidadeCampos(data: z.infer<typeof unidadeSchema>): UnidadeCampos | string {
  const digits = onlyDigits(data.cnpj);
  if (digits !== "" && !isValidCnpj(digits)) {
    return "CNPJ da unidade inválido: os dígitos verificadores não conferem.";
  }
  return {
    code: data.code.toUpperCase(),
    name: data.name,
    city: data.city || null,
    state_uf: data.state_uf || null,
    cnpj: digits === "" ? null : digits,
    headcount: Number.isNaN(data.headcount) ? null : data.headcount,
    sort_order: Number.isNaN(data.sort_order) ? 0 : data.sort_order,
  };
}

/** 23505 é o UNIQUE `(org_id, code)`; a frase precisa dizer isso. */
const CODE_TAKEN = "Já existe uma unidade com esse código nesta organização.";

export async function criarUnidade(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const eco = echo(formData, ...ECO_UNIDADE);
  const parsed = parseUnidade(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const campos = unidadeCampos(parsed.data);
  if (typeof campos === "string") return { error: campos, enviado: eco };

  const staff = await getStaffContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_units")
    .insert({ org_id: staff.orgId, ...campos })
    .select("id");

  if (error) {
    if (error.code === "23505") return { error: CODE_TAKEN, enviado: eco };
    return {
      ...fail("criar unidade", error.message, "Não foi possível criar a unidade."),
      enviado: eco,
    };
  }
  if (!data || data.length === 0) return { error: VANISHED, enviado: eco };

  revalidateSettings();
  return { ok: true, aviso: `Unidade "${campos.name}" criada. Ela já aparece no formulário público.` };
}

export async function salvarUnidade(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const eco = echo(formData, ...ECO_UNIDADE);
  const id = text(formData, "id");
  if (!UUID.test(id)) return { error: "Unidade inválida.", enviado: eco };

  const parsed = parseUnidade(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const campos = unidadeCampos(parsed.data);
  if (typeof campos === "string") return { error: campos, enviado: eco };

  const supabase = await createClient();
  const { data, error } = await supabase.from("org_units").update(campos).eq("id", id).select("id");

  if (error) {
    if (error.code === "23505") return { error: CODE_TAKEN, enviado: eco };
    return {
      ...fail("salvar unidade", error.message, "Não foi possível salvar a unidade."),
      enviado: eco,
    };
  }
  if (!data || data.length === 0) return { error: VANISHED, enviado: eco };

  revalidateSettings();
  return OK;
}

/**
 * Ativar/desativar, nunca apagar. Não existe policy de DELETE em `org_units` —
 * e isso é deliberado: cada relato aponta para a unidade em que aconteceu.
 * Apagar a linha deixaria o histórico sem lugar, e o indicador por unidade
 * deixaria de fechar com o total.
 */
export async function alternarUnidade(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = text(formData, "id");
  if (!UUID.test(id)) return { error: "Unidade inválida." };
  const ativar = checked(formData, "ativar");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_units")
    .update({ is_active: ativar })
    .eq("id", id)
    .select("id");

  if (error) return fail("alternar unidade", error.message, "Não foi possível alterar a unidade.");
  if (!data || data.length === 0) return { error: VANISHED };

  revalidateSettings();
  return {
    ok: true,
    aviso: ativar
      ? "Unidade reativada: volta a aparecer no formulário público."
      : "Unidade desativada: some do formulário público, mas os relatos já vinculados a ela continuam intactos.",
  };
}

// ── Categorias ───────────────────────────────────────────────────────────────

const categoriaSchema = z.object({
  label_pt: z
    .string()
    .trim()
    .min(3, "Informe o rótulo que aparece no formulário público.")
    .max(150, "Rótulo longo demais."),
  code: z.string().trim(),
  group_key: z.enum(["violencia_conduta", "organizacao_trabalho"], "Escolha o grupo."),
  default_risk: z.enum(["baixo", "moderado", "alto", "critico"], "Escolha o risco padrão."),
  description_pt: z.string().trim().max(600, "Descrição longa demais."),
  nr_reference: z.string().trim().max(60, "Referência longa demais."),
  sort_order: z.union([z.number().int(), z.nan()]),
});

const ECO_CATEGORIA = [
  "label_pt",
  "code",
  "group_key",
  "default_risk",
  "description_pt",
  "nr_reference",
  "sort_order",
  "requires_specification",
] as const;

function parseCategoria(formData: FormData) {
  return categoriaSchema.safeParse({
    label_pt: text(formData, "label_pt"),
    code: text(formData, "code"),
    group_key: text(formData, "group_key"),
    default_risk: text(formData, "default_risk"),
    description_pt: text(formData, "description_pt"),
    nr_reference: text(formData, "nr_reference"),
    sort_order: num(formData, "sort_order"),
  });
}

const CODE_RULE = /^[a-z0-9_]{3,60}$/;

export async function criarCategoria(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const eco = echo(formData, ...ECO_CATEGORIA);
  const parsed = parseCategoria(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const code = parsed.data.code ? slugifyCode(parsed.data.code) : slugifyCode(parsed.data.label_pt);
  if (!CODE_RULE.test(code)) {
    return {
      error: "Código inválido: use de 3 a 60 caracteres entre letras minúsculas, números e _.",
      enviado: eco,
    };
  }

  const staff = await getStaffContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    // `org_id` preenchido é o que a policy `categories_insert` exige — e é o
    // que separa a categoria da organização do catálogo regulatório global.
    .insert({
      org_id: staff.orgId,
      code,
      label_pt: parsed.data.label_pt,
      group_key: parsed.data.group_key,
      default_risk: parsed.data.default_risk,
      description_pt: parsed.data.description_pt || null,
      nr_reference: parsed.data.nr_reference || null,
      requires_specification: checked(formData, "requires_specification"),
      sort_order: Number.isNaN(parsed.data.sort_order) ? 900 : parsed.data.sort_order,
    })
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma categoria desta organização com esse código.", enviado: eco };
    }
    return {
      ...fail("criar categoria", error.message, "Não foi possível criar a categoria."),
      enviado: eco,
    };
  }
  if (!data || data.length === 0) return { error: VANISHED, enviado: eco };

  revalidateSettings();
  return {
    ok: true,
    aviso: `Categoria "${parsed.data.label_pt}" criada e já disponível no formulário público.`,
  };
}

export async function salvarCategoria(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const eco = echo(formData, ...ECO_CATEGORIA);
  const id = text(formData, "id");
  if (!UUID.test(id)) return { error: "Categoria inválida.", enviado: eco };

  const parsed = parseCategoria(formData);
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({
      label_pt: parsed.data.label_pt,
      group_key: parsed.data.group_key,
      default_risk: parsed.data.default_risk,
      description_pt: parsed.data.description_pt || null,
      nr_reference: parsed.data.nr_reference || null,
      requires_specification: checked(formData, "requires_specification"),
      sort_order: Number.isNaN(parsed.data.sort_order) ? 900 : parsed.data.sort_order,
    })
    .eq("id", id)
    .select("id");

  if (error) {
    return {
      ...fail("salvar categoria", error.message, "Não foi possível salvar a categoria."),
      enviado: eco,
    };
  }
  // A policy `categories_update` exige `org_id IS NOT NULL`: uma das 19 do
  // catálogo global cai exatamente aqui, com zero linhas e sem erro.
  if (!data || data.length === 0) {
    return {
      error:
        "Nada foi gravado. As 19 categorias do catálogo NR-01/NR-05 são globais e não podem ser editadas por nenhuma organização — crie uma categoria própria em vez de alterar a do catálogo.",
      enviado: eco,
    };
  }

  revalidateSettings();
  return OK;
}

export async function alternarCategoria(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = text(formData, "id");
  if (!UUID.test(id)) return { error: "Categoria inválida." };
  const ativar = checked(formData, "ativar");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .update({ is_active: ativar })
    .eq("id", id)
    .select("id");

  if (error) return fail("alternar categoria", error.message, "Não foi possível alterar.");
  if (!data || data.length === 0) {
    return {
      error:
        "Nada foi gravado: as categorias do catálogo NR-01/NR-05 são globais e só a organização dona pode alterar as suas.",
    };
  }

  revalidateSettings();
  return {
    ok: true,
    aviso: ativar
      ? "Categoria reativada no formulário público."
      : "Categoria desativada: some do formulário público; os relatos já classificados nela continuam.",
  };
}

// ── Equipe ───────────────────────────────────────────────────────────────────

/**
 * Quantos administradores ATIVOS a organização tem, ignorando um vínculo.
 *
 * Existe por um motivo só: se o último admin se rebaixar ou se suspender, a
 * organização fica sem ninguém que possa mexer em Configurações, convidar
 * gente ou reverter a mudança — e a RLS é honesta demais para abrir exceção
 * depois. A conta roda sob RLS (`members_read` já limita à organização).
 */
async function outrosAdminsAtivos(orgId: string, exceptMemberId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("org_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "admin")
    .eq("status", "active")
    .neq("id", exceptMemberId);
  return count ?? 0;
}

const LAST_ADMIN =
  "Recusado: este é o último administrador ativo da organização. Se a mudança fosse aplicada, ninguém poderia mais abrir Configurações, convidar pessoas nem desfazer isso — nem você. Promova outra pessoa a Administração antes.";

const papelSchema = z.object({
  id: z.string().regex(UUID, "Vínculo inválido."),
  role: z.enum(["admin", "triagem", "investigador", "comite"], "Escolha um papel."),
});

export async function alterarPapel(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const eco = echo(formData, "role");
  const parsed = papelSchema.safeParse({ id: text(formData, "id"), role: text(formData, "role") });
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("org_members")
    .select("id, org_id, user_id, role, status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!member) return { error: "Vínculo não encontrado nesta organização.", enviado: eco };
  if (member.role === parsed.data.role) return OK;

  // Rebaixar um admin ativo só é seguro se sobrar outro.
  if (member.role === "admin" && member.status === "active" && parsed.data.role !== "admin") {
    if ((await outrosAdminsAtivos(member.org_id, member.id)) === 0) {
      return {
        error:
          member.user_id === staff.userId
            ? LAST_ADMIN
            : "Recusado: esta pessoa é o último administrador ativo da organização.",
        enviado: eco,
      };
    }
  }

  const { data, error } = await supabase
    .from("org_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.id)
    .select("id");

  if (error) {
    return { ...fail("alterar papel", error.message, "Não foi possível alterar o papel."), enviado: eco };
  }
  if (!data || data.length === 0) return { error: VANISHED, enviado: eco };

  revalidateSettings();
  return { ok: true, aviso: "Papel alterado. O acesso muda no próximo carregamento da pessoa." };
}

const situacaoSchema = z.object({
  id: z.string().regex(UUID, "Vínculo inválido."),
  status: z.enum(["invited", "active", "suspended"], "Situação inválida."),
});

/**
 * Suspender/reativar. `revoked_at` e `activated_at` viajam junto com o status
 * porque são a data que a tela e o relatório de prestação de contas leem — se
 * ficassem para depois, um membro reativado apareceria como revogado.
 */
export async function alterarSituacaoMembro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = situacaoSchema.safeParse({
    id: text(formData, "id"),
    status: text(formData, "status"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("org_members")
    .select("id, org_id, user_id, role, status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!member) return { error: "Vínculo não encontrado nesta organização." };
  if (member.status === parsed.data.status) return OK;

  if (
    member.role === "admin" &&
    member.status === "active" &&
    parsed.data.status !== "active" &&
    (await outrosAdminsAtivos(member.org_id, member.id)) === 0
  ) {
    return {
      error:
        member.user_id === staff.userId
          ? LAST_ADMIN
          : "Recusado: esta pessoa é o último administrador ativo da organização.",
    };
  }

  const now = new Date().toISOString();
  const patch: { status: typeof parsed.data.status; revoked_at: string | null; activated_at?: string } = {
    status: parsed.data.status,
    revoked_at: parsed.data.status === "suspended" ? now : null,
  };
  // `activated_at` marca quando o acesso passou a valer; reativar renova a data,
  // que é a que o relatório de prestação de contas lê como "acesso desde".
  if (parsed.data.status === "active") patch.activated_at = now;

  const { data, error } = await supabase
    .from("org_members")
    .update(patch)
    .eq("id", parsed.data.id)
    .select("id");

  if (error) return fail("alterar situação", error.message, "Não foi possível alterar a situação.");
  if (!data || data.length === 0) return { error: VANISHED };

  revalidateSettings();
  return {
    ok: true,
    aviso:
      parsed.data.status === "suspended"
        ? "Acesso suspenso. A pessoa continua autenticada até o próximo carregamento e cai em /sem-acesso."
        : "Acesso liberado. A pessoa entra no painel no próximo carregamento.",
  };
}

const removerSchema = z.object({ id: z.string().regex(UUID, "Vínculo inválido.") });

/**
 * Remove o vínculo por completo — some da lista, diferente de suspender.
 * A conta de autenticação da pessoa não é tocada aqui: ela pode ter vínculo
 * com outra organização, e mesmo sem nenhum outro continua podendo ser
 * reconvidada depois. `members_delete` (RLS) já exige admin; o gate aqui é
 * só cortesia, como nas ações acima.
 *
 * Ninguém remove o próprio vínculo por aqui — além do risco óbvio de
 * autoexclusão acidental, `app.write_audit` (chamado pelo trigger de
 * auditoria) exige que quem grava o evento ainda tenha um vínculo ativo
 * nesta organização; removendo a si mesmo, essa checagem falharia depois
 * que a própria linha já tivesse sumido, e a operação inteira seria desfeita
 * com um erro confuso. Peça a outro administrador.
 */
export async function removerMembro(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = removerSchema.safeParse({ id: text(formData, "id") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const staff = await getStaffContext();
  const supabase = await createClient();

  const { data: member } = await supabase
    .from("org_members")
    .select("id, org_id, user_id, role, status")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!member) return { error: "Vínculo não encontrado nesta organização." };

  if (member.user_id === staff.userId) {
    return { error: "Peça a outro administrador para remover o seu próprio acesso." };
  }

  if (
    member.role === "admin" &&
    member.status === "active" &&
    (await outrosAdminsAtivos(member.org_id, member.id)) === 0
  ) {
    return { error: "Recusado: esta pessoa é o último administrador ativo da organização." };
  }

  const { error, count } = await supabase
    .from("org_members")
    .delete({ count: "exact" })
    .eq("id", parsed.data.id);

  if (error) return fail("remover vínculo", error.message, "Não foi possível remover este acesso.");
  if (!count) return { error: VANISHED };

  revalidateSettings();
  return { ok: true, aviso: "Removido do time. Para voltar a ter acesso, será preciso convidar de novo." };
}

// ── Permissões por cargo ─────────────────────────────────────────────────────

const NAV_KEYS = CONFIGURABLE_NAV_ITEMS.map(item => item.key);

const permissoesSchema = z.object({
  role: z.enum(["triagem", "investigador", "comite"], "Escolha um cargo."),
});

/**
 * Grava as 6 linhas do cargo (uma por item de `CONFIGURABLE_NAV_ITEMS`), não
 * só as marcadas — assim a tabela nunca fica ambígua entre "não configurado"
 * (cai no `defaultRoles` de `isNavVisible`) e "desmarcado" (`visible: false`
 * explícito). Quem recusa de verdade é `role_nav_permissions_write` (exige
 * `admin`); o guard aqui é só cortesia, como em toda esta seção.
 */
export async function atualizarPermissoesPapel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = permissoesSchema.safeParse({ role: text(formData, "role") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const staff = await getStaffContext();
  const supabase = await createClient();

  const marcados = new Set(formData.getAll("nav_key").map(String));
  const linhas = NAV_KEYS.map(nav_key => ({
    org_id: staff.orgId,
    role: parsed.data.role,
    nav_key,
    visible: marcados.has(nav_key),
  }));

  const { error } = await supabase
    .from("role_nav_permissions")
    .upsert(linhas, { onConflict: "org_id,role,nav_key" });

  if (error) {
    return fail("alterar permissões", error.message, "Não foi possível salvar as permissões.");
  }

  revalidateSettings();
  return { ok: true, aviso: "Permissões salvas. O menu muda no próximo carregamento da pessoa." };
}
