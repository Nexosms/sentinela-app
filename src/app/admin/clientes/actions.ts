"use server";

import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getStaffContext, isNexoAdmin } from "@/lib/org/context";
import { onlyDigits, isValidDocumento } from "@/lib/admin/configuracoes";
import { provisionAuthUser } from "@/lib/admin/authProvisioning";
import { relatoUrl } from "@/lib/admin/clientes";

/**
 * Cadastro de empresa-cliente. Só a equipe Nexo (`isNexoAdmin()`) chega aqui —
 * a página já barra quem não é; o teste de novo aqui é cortesia, no mesmo
 * espírito do resto do projeto.
 *
 * ── Por que via service role ─────────────────────────────────────────────────
 * `organizations` não tem policy de INSERT (bootstrapping é sempre fora da
 * RLS), e o primeiro `org_members` de uma organização nova esbarra no mesmo
 * problema: `members_insert` exige `app.has_role(org_id, {admin})`, e ainda
 * não existe nenhum admin ali para satisfazer isso. As três gravações abaixo
 * (organização, vínculo da própria Nexo, vínculo do contato do cliente) usam
 * `createAdminClient()` por isso — é o quinto lugar autorizado no ESLint,
 * pelo mesmo motivo estrutural dos outros quatro.
 *
 * ── Auditoria ─────────────────────────────────────────────────────────────────
 * Como os inserts vão pelo service role (sem JWT de usuário), `auth.uid()`
 * dentro do trigger é nulo — `app.write_audit` grava `actor_type: 'system'`
 * em vez do admin de verdade. Aceitável aqui: é literalmente o sistema
 * provisionando uma organização nova, não uma ação de rotina.
 */

export type ActionState = {
  ok?: true;
  error?: string;
  inviteUrl?: string | null;
  emailSent?: boolean;
  novaOrgId?: string;
  novaOrgSlug?: string;
  relatoUrl?: string;
};

const schema = z.object({
  tradeName: z.string().trim().min(2, "Informe o nome fantasia.").max(120),
  legalName: z.string().trim().min(2, "Informe a razão social.").max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "O slug só pode ter letras minúsculas, números e hífen (3 a 40 caracteres)."),
  cnpj: z
    .string()
    .trim()
    .optional()
    .transform(value => (value ? onlyDigits(value) : ""))
    .refine(value => value === "" || isValidDocumento(value), "Documento inválido."),
  address: z.string().trim().max(300).optional(),
  contactEmail: z
    .string()
    .trim()
    .optional()
    .transform(value => (value ? value.toLowerCase() : ""))
    .refine(value => value === "" || z.email().safeParse(value).success, "Informe um e-mail válido."),
  contactName: z.string().trim().max(120).optional(),
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function criarEmpresaCliente(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isNexoAdmin())) {
    return { error: "Só a equipe Nexo pode cadastrar empresas-cliente." };
  }

  const parsed = schema.safeParse({
    tradeName: text(formData, "tradeName"),
    legalName: text(formData, "legalName"),
    slug: text(formData, "slug"),
    cnpj: text(formData, "cnpj"),
    address: text(formData, "address"),
    contactEmail: text(formData, "contactEmail"),
    contactName: text(formData, "contactName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { tradeName, legalName, slug, cnpj, address, contactEmail, contactName } = parsed.data;

  // Contato é opcional no cadastro — mas se um dos dois vier, os dois precisam vir.
  if (Boolean(contactEmail) !== Boolean(contactName)) {
    return { error: "Informe o nome e o e-mail do contato, ou deixe os dois em branco." };
  }

  const staff = await getStaffContext();
  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      slug,
      trade_name: tradeName,
      legal_name: legalName,
      cnpj: cnpj || null,
      address: address || null,
    })
    .select("id, slug")
    .maybeSingle();

  if (orgError) {
    if (orgError.code === "23505") {
      const campo = orgError.message.includes("cnpj") ? "documento" : "slug";
      return { error: `Já existe uma organização com este ${campo}.` };
    }
    console.error("[clientes] criar organização: %s", orgError.message);
    return { error: "Não foi possível criar a organização. Tente novamente." };
  }
  if (!org) return { error: "A organização não foi criada." };

  // O vínculo da Nexo (e de todo mundo que já está na Sentinela, com o mesmo
  // papel) é criado automaticamente pelo trigger `t_seed_org_members_from_sentinela`
  // (migração 035) assim que a linha acima é inserida — nada a fazer aqui.

  // Sem contato informado: organização criada, convite fica para depois
  // (tela da empresa em /admin/clientes/[orgId]).
  if (!contactEmail) {
    return { ok: true, novaOrgId: org.id, novaOrgSlug: org.slug, relatoUrl: relatoUrl(org.slug) };
  }

  let inviteUrl: string | null = null;
  let emailSent = false;
  try {
    // `contactName` já foi garantido não-vazio pelo par com `contactEmail` acima.
    const provisioned = await provisionAuthUser(admin, contactEmail, contactName ?? "");
    inviteUrl = provisioned.inviteUrl;
    emailSent = provisioned.emailSent;

    const { error: clienteError } = await admin.from("org_members").insert({
      org_id: org.id,
      user_id: provisioned.userId,
      role: "comite",
      status: "invited",
      invited_by: staff.userId,
    });
    if (clienteError) {
      console.error("[clientes] vínculo do contato: %s", clienteError.message);
      return {
        error:
          "A organização foi criada, mas o vínculo do contato do cliente falhou. Convide-o depois, na tela da empresa.",
      };
    }
  } catch (error) {
    console.error("[clientes] convite do contato: %s", error instanceof Error ? error.message : error);
    return {
      error:
        "A organização foi criada, mas não foi possível convidar o contato agora. Convide-o depois, na tela da empresa.",
    };
  }

  return {
    ok: true,
    inviteUrl,
    emailSent,
    novaOrgId: org.id,
    novaOrgSlug: org.slug,
    relatoUrl: relatoUrl(org.slug),
  };
}

const convidarContatoSchema = z.object({
  orgId: z.uuid(),
  contactName: z.string().trim().min(3, "Informe o nome do contato.").max(120),
  contactEmail: z.email("Informe um e-mail válido.").max(320).transform(v => v.trim().toLowerCase()),
});

/**
 * Convida o contato de uma empresa-cliente já existente — para quando o
 * cadastro foi feito sem contato. Diferente de `criarEmpresaCliente`, o
 * vínculo em `org_members` vai pelo cliente de sessão sob RLS: a Nexo já
 * tem vínculo `admin` NESTA organização (criado junto com ela), então
 * `members_insert` já autoriza, independente de qual organização está
 * "ativa" no cookie agora — mesmo raciocínio de `editarEmpresaCliente`.
 * Só a Admin API de auth (`provisionAuthUser`) precisa de service role.
 */
export async function convidarContatoCliente(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isNexoAdmin())) {
    return { error: "Só a equipe Nexo pode convidar o contato de uma empresa-cliente." };
  }

  const parsed = convidarContatoSchema.safeParse({
    orgId: text(formData, "orgId"),
    contactName: text(formData, "contactName"),
    contactEmail: text(formData, "contactEmail"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { orgId, contactName, contactEmail } = parsed.data;

  const staff = await getStaffContext();
  const admin = createAdminClient();
  const supabase = await createClient();

  let inviteUrl: string | null = null;
  let emailSent = false;
  try {
    const provisioned = await provisionAuthUser(admin, contactEmail, contactName);
    inviteUrl = provisioned.inviteUrl;
    emailSent = provisioned.emailSent;

    const { error } = await supabase.from("org_members").insert({
      org_id: orgId,
      user_id: provisioned.userId,
      role: "comite",
      status: "invited",
      invited_by: staff.userId,
    });
    if (error) {
      if (error.code === "23505") {
        return { error: "Essa pessoa já tem vínculo com esta organização.", inviteUrl, emailSent };
      }
      console.error("[clientes] vínculo do contato (depois): %s", error.message);
      return { error: "Não foi possível vincular o contato a esta organização." };
    }
  } catch (error) {
    console.error("[clientes] convite do contato (depois): %s", error instanceof Error ? error.message : error);
    return { error: "Não foi possível convidar o contato agora. Tente de novo." };
  }

  return { ok: true, inviteUrl, emailSent };
}

/**
 * Edita os dados cadastrais de uma empresa-cliente já existente. Ao contrário
 * de `criarEmpresaCliente`, isto NÃO precisa de service role: `org_update`
 * já autoriza sob RLS quem tem papel admin naquela organização — independente
 * de qual organização está "ativa" no cookie no momento.
 */
export type EditState = { ok?: true; error?: string };

const editSchema = z.object({
  orgId: z.uuid(),
  tradeName: z.string().trim().min(2, "Informe o nome fantasia.").max(120),
  legalName: z.string().trim().min(2, "Informe a razão social.").max(160),
  cnpj: z
    .string()
    .trim()
    .optional()
    .transform(value => (value ? onlyDigits(value) : ""))
    .refine(value => value === "" || isValidDocumento(value), "Documento inválido."),
  address: z.string().trim().max(300).optional(),
});

export async function editarEmpresaCliente(_prev: EditState, formData: FormData): Promise<EditState> {
  const parsed = editSchema.safeParse({
    orgId: text(formData, "orgId"),
    tradeName: text(formData, "tradeName"),
    legalName: text(formData, "legalName"),
    cnpj: text(formData, "cnpj"),
    address: text(formData, "address"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      trade_name: parsed.data.tradeName,
      legal_name: parsed.data.legalName,
      cnpj: parsed.data.cnpj || null,
      address: parsed.data.address || null,
    })
    .eq("id", parsed.data.orgId)
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { error: "Já existe outra organização com este documento." };
    console.error("[clientes] editar organização: %s", error.message);
    return { error: "Não foi possível salvar. Tente novamente." };
  }
  if (!data) {
    return {
      error: "Nada foi gravado: você não é administrador desta organização, ou ela não existe mais.",
    };
  }

  return { ok: true };
}
