"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { isNexoAdmin } from "@/lib/org/context";
import { todayInSaoPaulo } from "@/lib/admin/labels";
import {
  PORTAL_BUCKET,
  PORTAL_MAX_BYTES,
  extForMime,
  isAllowedMime,
  isMediaMime,
  resolveMime,
} from "@/lib/portal/files";
import {
  ACTION_STATUS,
  FOLDER_CATEGORY,
  MATERIAL_CATEGORIES,
  MEETING_STATUS,
  fromDatetimeLocal,
  fromMonthYear,
  parseParticipants,
  portalAdminFolderPath,
  portalAdminMeetingPath,
  portalAdminPath,
} from "@/lib/portal/portal";

/**
 * Gestão do Portal do Cliente — só a equipe Nexo (admin da organização
 * Sentinela) escreve. Quem autoriza de verdade é a RLS (`app.is_nexo_admin()`
 * nas policies de `portal_*`); o `isNexoAdmin()` daqui é cortesia, para dar uma
 * mensagem clara em vez de um "zero linhas afetadas" mudo.
 *
 * O `org_id` de tudo vem da URL (`orgId`), nunca da organização "ativa" no
 * cookie: a Nexo administra todas as empresas pela mesma sessão.
 *
 * Service role (`createAdminClient`) só para o Storage — o bucket `portal` é
 * privado e sem policies, então assinar URL de envio e apagar objeto exigem a
 * chave. Todas as gravações em tabela vão pelo cliente de sessão, sob RLS.
 *
 * ⚠️ UPDATE/DELETE barrados pela RLS não dão erro no PostgREST: afetam zero
 * linhas. Toda mutação pede `.select("id")` de volta e trata lista vazia como
 * recusa.
 */

export type ActionState = {
  ok?: true;
  error?: string;
  aviso?: string;
  /** Eco do que foi digitado: o React limpa o `<form action>` mesmo quando a ação recusa. */
  enviado?: Record<string, string>;
  /** Muda a cada sucesso; o formulário usa como `key` para limpar campos e o seletor de arquivo. */
  stamp?: string;
};

const UUID = z.uuid();
const NAO_NEXO = "Só a equipe Nexo pode gerenciar o portal do cliente.";
const SEM_ALCANCE =
  "Não foi possível gravar — o item pode ter sido removido ou saiu do seu alcance. Recarregue a página.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function flag(formData: FormData, name: string): boolean {
  return formData.get(name) === "1";
}

function echo(formData: FormData, ...names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") out[name] = value;
  }
  return out;
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dados inválidos.";
}

function fail(escopo: string, message: string, humano: string): ActionState {
  console.error("[portal] %s: %s", escopo, message);
  return { error: humano };
}

function done(aviso: string): ActionState {
  return { ok: true, aviso, stamp: randomUUID() };
}

function revalidar() {
  revalidatePath("/admin", "layout");
}

type Contexto = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string };

/** Nexo + empresa existente. Devolve o cliente sob RLS já pronto, ou a mensagem de recusa. */
async function exigirNexo(orgId: string): Promise<Contexto | { error: string }> {
  if (!UUID.safeParse(orgId).success) return { error: "Empresa inválida." };
  if (!(await isNexoAdmin())) return { error: NAO_NEXO };
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").eq("id", orgId).maybeSingle();
  if (!org) return { error: "Empresa não encontrada." };
  return { supabase, userId: user.id };
}

async function removerObjetos(paths: string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await createAdminClient().storage.from(PORTAL_BUCKET).remove(paths);
  if (error) {
    console.error("[portal] remover objetos: %s", error.message);
    return false;
  }
  return true;
}

// ── Upload ──────────────────────────────────────────────────────────────────

const KINDS = ["recording", "meeting_file", "material"] as const;
type Kind = (typeof KINDS)[number];

export type UploadTicket = { path: string; token: string; mime: string } | { error: string };

/**
 * Passo 1 do envio: devolve um caminho e um token de upload assinado. Os bytes
 * vão direto do navegador ao Storage (nunca por uma função da Vercel, que
 * limita o corpo a 4,5 MB), então aqui só há metadados.
 */
export async function solicitarUpload(input: {
  orgId: string;
  kind: string;
  filename: string;
  size: number;
  type: string;
}): Promise<UploadTicket> {
  const ctx = await exigirNexo(input.orgId);
  if ("error" in ctx) return ctx;

  if (!(KINDS as readonly string[]).includes(input.kind)) return { error: "Tipo de conteúdo inválido." };
  const mime = resolveMime(input.filename, input.type);
  if (!mime) {
    return { error: "Tipo de arquivo não aceito. Use PDF, Word, Excel, PowerPoint, imagem, áudio ou vídeo." };
  }
  if (input.kind === "recording" && !isMediaMime(mime)) {
    return { error: "A gravação precisa ser um arquivo de áudio ou vídeo." };
  }
  if (!Number.isFinite(input.size) || input.size <= 0) return { error: "Arquivo vazio." };
  if (input.size > PORTAL_MAX_BYTES) return { error: "Arquivo acima do limite de 2 GB." };

  const path = `${input.orgId}/${randomUUID()}.${extForMime(mime)}`;
  const { data, error } = await createAdminClient()
    .storage.from(PORTAL_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[portal] createSignedUploadUrl: %s", error?.message ?? "sem retorno");
    return { error: "Não foi possível preparar o envio. Tente novamente." };
  }
  return { path, token: data.token, mime };
}

const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.[a-z0-9]+$/;

/** Passo 2: não se confia no que o navegador declarou — relê tamanho e tipo reais no Storage. */
async function conferirObjeto(
  orgId: string,
  path: string,
): Promise<{ size: number; mime: string } | { error: string }> {
  if (!PATH_RE.test(path) || !path.startsWith(`${orgId}/`)) {
    return { error: "Arquivo inválido. Envie novamente." };
  }
  const { data: info, error } = await createAdminClient().storage.from(PORTAL_BUCKET).info(path);
  if (error || !info) return { error: "O arquivo não chegou ao servidor. Envie novamente." };

  const size = info.size ?? 0;
  const mime = (info.contentType ?? "").toLowerCase().split(";")[0].trim();
  if (size <= 0) return { error: "Arquivo vazio." };
  if (size > PORTAL_MAX_BYTES) return { error: "Arquivo acima do limite de 2 GB." };
  if (!isAllowedMime(mime)) return { error: "Tipo de arquivo não aceito." };
  return { size, mime };
}

function nomeSeguro(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "arquivo";
  return base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || "arquivo";
}

// ── Reuniões ────────────────────────────────────────────────────────────────

const reuniaoSchema = z.object({
  title: z.string().trim().min(3, "Dê um título à reunião (mín. 3 caracteres).").max(200, "Título longo demais."),
  status: z.enum(MEETING_STATUS, "Situação inválida."),
  summary: z.string().trim().max(20000, "Resumo longo demais."),
});

export async function salvarReuniao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const id = text(formData, "id");
  const eco = echo(formData, "title", "meeting_at", "participants", "status", "summary", "is_published");

  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return { error: ctx.error, enviado: eco };

  const parsed = reuniaoSchema.safeParse({
    title: text(formData, "title"),
    status: text(formData, "status"),
    summary: text(formData, "summary"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const meetingAt = fromDatetimeLocal(text(formData, "meeting_at"));
  if (!meetingAt) return { error: "Informe a data e a hora da reunião.", enviado: eco };

  const values = {
    title: parsed.data.title,
    status: parsed.data.status,
    summary: parsed.data.summary || null,
    meeting_at: meetingAt,
    participants: parseParticipants(text(formData, "participants")),
    is_published: flag(formData, "is_published"),
  };

  if (id) {
    if (!UUID.safeParse(id).success) return { error: "Reunião inválida.", enviado: eco };
    const { data, error } = await ctx.supabase
      .from("portal_meetings")
      .update(values)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id");
    if (error) return { ...fail("editar reunião", error.message, "Não foi possível salvar a reunião."), enviado: eco };
    if (!data || data.length === 0) return { error: SEM_ALCANCE, enviado: eco };
    revalidar();
    return done(values.is_published ? "Reunião salva e visível ao cliente." : "Reunião salva (rascunho — o cliente não vê).");
  }

  const { data, error } = await ctx.supabase
    .from("portal_meetings")
    .insert({ ...values, org_id: orgId, created_by: ctx.userId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ...fail("criar reunião", error?.message ?? "insert sem retorno", "Não foi possível criar a reunião."), enviado: eco };
  }
  revalidar();
  redirect(portalAdminMeetingPath(orgId, data.id));
}

export async function excluirReuniao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const id = text(formData, "id");
  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return ctx;
  if (!UUID.safeParse(id).success) return { error: "Reunião inválida." };

  // O ON DELETE CASCADE apaga as linhas de arquivo, não os objetos do Storage:
  // sem isto, a gravação continuaria ocupando espaço sem que ninguém a enxergue.
  const { data: arquivos } = await ctx.supabase
    .from("portal_files")
    .select("storage_path")
    .eq("meeting_id", id)
    .eq("org_id", orgId);
  if (!(await removerObjetos((arquivos ?? []).map(file => file.storage_path)))) {
    return { error: "Não foi possível remover os arquivos da reunião do armazenamento. Tente de novo." };
  }

  const { data, error } = await ctx.supabase
    .from("portal_meetings")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id");
  if (error) return fail("excluir reunião", error.message, "Não foi possível excluir a reunião.");
  if (!data || data.length === 0) return { error: SEM_ALCANCE };

  revalidar();
  redirect(portalAdminPath(orgId));
}

const transcricaoSchema = z.object({
  transcript: z.string().max(500000, "Transcrição longa demais (máx. 500 mil caracteres)."),
});

/** Aba Transcrição: texto corrido da reunião. Salvar vazio apaga. */
export async function salvarTranscricao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const id = text(formData, "id");
  const raw = formData.get("transcript");
  const eco = { transcript: typeof raw === "string" ? raw : "" };

  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return { error: ctx.error, enviado: eco };
  if (!UUID.safeParse(id).success) return { error: "Reunião inválida.", enviado: eco };

  const parsed = transcricaoSchema.safeParse({ transcript: eco.transcript });
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const valor = parsed.data.transcript.trim();
  const { data, error } = await ctx.supabase
    .from("portal_meetings")
    .update({ transcript: valor === "" ? null : valor })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id");
  if (error) return { ...fail("salvar transcrição", error.message, "Não foi possível salvar a transcrição."), enviado: eco };
  if (!data || data.length === 0) return { error: SEM_ALCANCE, enviado: eco };
  revalidar();
  return done(valor === "" ? "Transcrição removida." : "Transcrição salva.");
}

// ── Ações da reunião ────────────────────────────────────────────────────────

const acaoSchema = z.object({
  description: z.string().trim().min(3, "Descreva a ação (mín. 3 caracteres).").max(2000, "Descrição longa demais."),
  owner_name: z.string().trim().max(200, "Nome do responsável longo demais."),
  status: z.enum(ACTION_STATUS, "Status inválido."),
  due_on: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Prazo inválido.")]),
});

export async function salvarAcao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const meetingId = text(formData, "meetingId");
  const id = text(formData, "id");
  const eco = echo(formData, "description", "owner_name", "due_on", "status");

  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return { error: ctx.error, enviado: eco };
  if (!UUID.safeParse(meetingId).success) return { error: "Reunião inválida.", enviado: eco };

  const parsed = acaoSchema.safeParse({
    description: text(formData, "description"),
    owner_name: text(formData, "owner_name"),
    status: text(formData, "status"),
    due_on: text(formData, "due_on"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const values = {
    description: parsed.data.description,
    owner_name: parsed.data.owner_name || null,
    status: parsed.data.status,
    due_on: parsed.data.due_on || null,
  };

  if (id) {
    if (!UUID.safeParse(id).success) return { error: "Ação inválida.", enviado: eco };
    const { data, error } = await ctx.supabase
      .from("portal_meeting_actions")
      .update(values)
      .eq("id", id)
      .eq("meeting_id", meetingId)
      .eq("org_id", orgId)
      .select("id");
    if (error) return { ...fail("editar ação", error.message, "Não foi possível salvar a ação."), enviado: eco };
    if (!data || data.length === 0) return { error: SEM_ALCANCE, enviado: eco };
    revalidar();
    return done("Ação salva.");
  }

  const { data: meeting } = await ctx.supabase
    .from("portal_meetings")
    .select("id")
    .eq("id", meetingId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!meeting) return { error: "Reunião não encontrada nesta empresa.", enviado: eco };

  const { data, error } = await ctx.supabase
    .from("portal_meeting_actions")
    .insert({ ...values, org_id: orgId, meeting_id: meetingId, created_by: ctx.userId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ...fail("criar ação", error?.message ?? "insert sem retorno", "Não foi possível registrar a ação."), enviado: eco };
  }
  revalidar();
  return done("Ação registrada.");
}

export async function excluirAcao(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const id = text(formData, "id");
  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return ctx;
  if (!UUID.safeParse(id).success) return { error: "Ação inválida." };

  const { data, error } = await ctx.supabase
    .from("portal_meeting_actions")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id");
  if (error) return fail("excluir ação", error.message, "Não foi possível excluir a ação.");
  if (!data || data.length === 0) return { error: SEM_ALCANCE };
  revalidar();
  return done("Ação excluída.");
}

// ── Arquivos (gravação, arquivos da reunião, materiais) ─────────────────────

const arquivoSchema = z.object({
  title: z.string().trim().min(1, "Dê um título ao arquivo.").max(200, "Título longo demais."),
  description: z.string().trim().max(2000, "Descrição longa demais."),
  published_at: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de publicação inválida.")]),
});

const CATEGORY_KEYS = MATERIAL_CATEGORIES.map(category => category.key) as [string, ...string[]];

export async function registrarArquivo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const kind = text(formData, "kind") as Kind;
  const meetingId = text(formData, "meetingId");
  const category = text(formData, "category");
  const path = text(formData, "storage_path");
  const eco = echo(formData, "title", "description", "published_at", "category", "is_published", "storage_path", "filename");

  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return { error: ctx.error, enviado: eco };
  if (!(KINDS as readonly string[]).includes(kind)) return { error: "Tipo de conteúdo inválido.", enviado: eco };

  if (!path) return { error: "Escolha o arquivo e aguarde o envio terminar.", enviado: eco };
  const parsed = arquivoSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    published_at: text(formData, "published_at"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  if (kind === "material") {
    if (!z.enum(CATEGORY_KEYS).safeParse(category).success) return { error: "Escolha a categoria.", enviado: eco };
  } else {
    if (!UUID.safeParse(meetingId).success) return { error: "Reunião inválida.", enviado: eco };
    const { data: meeting } = await ctx.supabase
      .from("portal_meetings")
      .select("id")
      .eq("id", meetingId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!meeting) return { error: "Reunião não encontrada nesta empresa.", enviado: eco };
  }

  const objeto = await conferirObjeto(orgId, path);
  if ("error" in objeto) return { error: objeto.error, enviado: eco };
  if (kind === "recording" && !isMediaMime(objeto.mime)) {
    return { error: "A gravação precisa ser um arquivo de áudio ou vídeo.", enviado: eco };
  }

  const { data, error } = await ctx.supabase
    .from("portal_files")
    .insert({
      org_id: orgId,
      kind,
      meeting_id: kind === "material" ? null : meetingId,
      category: kind === "material" ? category : null,
      title: parsed.data.title,
      description: parsed.data.description || null,
      published_at: parsed.data.published_at || todayInSaoPaulo(),
      storage_path: path,
      filename: nomeSeguro(text(formData, "filename")),
      mime_type: objeto.mime,
      size_bytes: objeto.size,
      is_published: kind === "material" ? flag(formData, "is_published") : false,
      created_by: ctx.userId,
    })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    const duplicado = error?.code === "23505";
    return {
      ...fail("registrar arquivo", error?.message ?? "insert sem retorno", duplicado ? "Este arquivo já foi registrado." : "Não foi possível registrar o arquivo."),
      enviado: eco,
    };
  }
  revalidar();
  return done("Arquivo publicado no portal.");
}

export async function editarArquivo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const id = text(formData, "id");
  const category = text(formData, "category");
  const eco = echo(formData, "title", "description", "published_at", "category", "is_published");

  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return { error: ctx.error, enviado: eco };
  if (!UUID.safeParse(id).success) return { error: "Arquivo inválido.", enviado: eco };

  const parsed = arquivoSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    published_at: text(formData, "published_at"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const { data: atual } = await ctx.supabase
    .from("portal_files")
    .select("kind, folder_id")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!atual) return { error: SEM_ALCANCE, enviado: eco };

  const patch: {
    title: string;
    description: string | null;
    published_at?: string;
    category?: string;
    is_published?: boolean;
  } = {
    title: parsed.data.title,
    description: parsed.data.description || null,
  };
  if (parsed.data.published_at) patch.published_at = parsed.data.published_at;
  // Dentro de uma pasta, categoria e visibilidade são da pasta.
  if (atual.kind === "material" && !atual.folder_id) {
    if (!z.enum(CATEGORY_KEYS).safeParse(category).success) return { error: "Escolha a categoria.", enviado: eco };
    patch.category = category;
    patch.is_published = flag(formData, "is_published");
  }

  const { data, error } = await ctx.supabase
    .from("portal_files")
    .update(patch)
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id");
  if (error) return { ...fail("editar arquivo", error.message, "Não foi possível salvar o arquivo."), enviado: eco };
  if (!data || data.length === 0) return { error: SEM_ALCANCE, enviado: eco };
  revalidar();
  return done("Arquivo atualizado.");
}

export async function substituirArquivo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const id = text(formData, "id");
  const path = text(formData, "storage_path");

  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return ctx;
  if (!UUID.safeParse(id).success) return { error: "Arquivo inválido." };
  if (!path) return { error: "Escolha o novo arquivo e aguarde o envio terminar." };

  const { data: atual } = await ctx.supabase
    .from("portal_files")
    .select("kind, storage_path")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!atual) return { error: SEM_ALCANCE };

  const objeto = await conferirObjeto(orgId, path);
  if ("error" in objeto) return objeto;
  if (atual.kind === "recording" && !isMediaMime(objeto.mime)) {
    return { error: "A gravação precisa ser um arquivo de áudio ou vídeo." };
  }

  const { data, error } = await ctx.supabase
    .from("portal_files")
    .update({
      storage_path: path,
      filename: nomeSeguro(text(formData, "filename")),
      mime_type: objeto.mime,
      size_bytes: objeto.size,
    })
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id");
  if (error) return fail("substituir arquivo", error.message, "Não foi possível substituir o arquivo.");
  if (!data || data.length === 0) return { error: SEM_ALCANCE };

  // Só depois de a linha apontar para o novo objeto é seguro apagar o antigo.
  await removerObjetos([atual.storage_path]);
  revalidar();
  return done("Arquivo substituído.");
}

export async function excluirArquivo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const id = text(formData, "id");
  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return ctx;
  if (!UUID.safeParse(id).success) return { error: "Arquivo inválido." };

  const { data: atual } = await ctx.supabase
    .from("portal_files")
    .select("storage_path")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!atual) return { error: SEM_ALCANCE };

  if (!(await removerObjetos([atual.storage_path]))) {
    return { error: "Não foi possível remover o arquivo do armazenamento. Tente de novo." };
  }
  const { data, error } = await ctx.supabase
    .from("portal_files")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id");
  if (error) return fail("excluir arquivo", error.message, "Não foi possível excluir o arquivo.");
  if (!data || data.length === 0) return { error: SEM_ALCANCE };
  revalidar();
  return done("Arquivo excluído.");
}

// ── Pastas (campanhas mensais do CDN Conecta) ───────────────────────────────

const pastaSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à pasta (mín. 2 caracteres).").max(200, "Nome longo demais."),
  description: z.string().trim().max(2000, "Descrição longa demais."),
});

export async function salvarPasta(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const id = text(formData, "id");
  const eco = echo(formData, "name", "month", "year", "description", "is_published");

  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return { error: ctx.error, enviado: eco };

  const parsed = pastaSchema.safeParse({
    name: text(formData, "name"),
    description: text(formData, "description"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error), enviado: eco };

  const referenceMonth = fromMonthYear(text(formData, "month"), text(formData, "year"));
  if (!referenceMonth) return { error: "Informe o mês e o ano da campanha.", enviado: eco };

  const values = {
    name: parsed.data.name,
    description: parsed.data.description || null,
    reference_month: referenceMonth,
    is_published: flag(formData, "is_published"),
  };

  if (id) {
    if (!UUID.safeParse(id).success) return { error: "Pasta inválida.", enviado: eco };
    const { data, error } = await ctx.supabase
      .from("portal_folders")
      .update(values)
      .eq("id", id)
      .eq("org_id", orgId)
      .select("id");
    if (error) return { ...fail("editar pasta", error.message, "Não foi possível salvar a pasta."), enviado: eco };
    if (!data || data.length === 0) return { error: SEM_ALCANCE, enviado: eco };
    revalidar();
    return done(values.is_published ? "Pasta salva e visível ao cliente." : "Pasta salva (rascunho — o cliente não vê).");
  }

  const { data, error } = await ctx.supabase
    .from("portal_folders")
    .insert({ ...values, org_id: orgId, category: FOLDER_CATEGORY, created_by: ctx.userId })
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ...fail("criar pasta", error?.message ?? "insert sem retorno", "Não foi possível criar a pasta."), enviado: eco };
  }
  revalidar();
  redirect(portalAdminFolderPath(orgId, data.id));
}

export async function excluirPasta(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const orgId = text(formData, "orgId");
  const id = text(formData, "id");
  const ctx = await exigirNexo(orgId);
  if ("error" in ctx) return ctx;
  if (!UUID.safeParse(id).success) return { error: "Pasta inválida." };

  // Como na reunião: o CASCADE apaga as linhas, não os objetos do Storage.
  const { data: arquivos } = await ctx.supabase
    .from("portal_files")
    .select("storage_path")
    .eq("folder_id", id)
    .eq("org_id", orgId);
  if (!(await removerObjetos((arquivos ?? []).map(file => file.storage_path)))) {
    return { error: "Não foi possível remover os arquivos da pasta do armazenamento. Tente de novo." };
  }

  const { data, error } = await ctx.supabase
    .from("portal_folders")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId)
    .select("id");
  if (error) return fail("excluir pasta", error.message, "Não foi possível excluir a pasta.");
  if (!data || data.length === 0) return { error: SEM_ALCANCE };

  revalidar();
  redirect(`${portalAdminPath(orgId)}?aba=materiais&categoria=${FOLDER_CATEGORY}`);
}

export type RegistroRapido = { ok: true } | { error: string };

/**
 * Registra UM arquivo já enviado dentro de uma pasta, sem formulário: o envio em
 * lote (vários arquivos, ou a pasta inteira do computador) chama isto a cada
 * arquivo que termina de subir. O título nasce do nome do arquivo e dá para
 * ajustar depois; categoria e visibilidade são da pasta.
 */
export async function registrarArquivoNaPasta(input: {
  orgId: string;
  folderId: string;
  path: string;
  filename: string;
}): Promise<RegistroRapido> {
  const ctx = await exigirNexo(input.orgId);
  if ("error" in ctx) return ctx;
  if (!UUID.safeParse(input.folderId).success) return { error: "Pasta inválida." };

  const { data: pasta } = await ctx.supabase
    .from("portal_folders")
    .select("id, category")
    .eq("id", input.folderId)
    .eq("org_id", input.orgId)
    .maybeSingle();
  if (!pasta) return { error: "Pasta não encontrada nesta empresa." };

  const objeto = await conferirObjeto(input.orgId, input.path);
  if ("error" in objeto) return objeto;

  const filename = nomeSeguro(input.filename);
  const { error } = await ctx.supabase.from("portal_files").insert({
    org_id: input.orgId,
    kind: "material",
    folder_id: pasta.id,
    category: pasta.category,
    title: filename.replace(/.[^.]+$/, "").slice(0, 200) || filename,
    description: null,
    published_at: todayInSaoPaulo(),
    storage_path: input.path,
    filename,
    mime_type: objeto.mime,
    size_bytes: objeto.size,
    is_published: true,
    created_by: ctx.userId,
  });
  if (error) {
    console.error("[portal] registrar arquivo na pasta: %s", error.message);
    return { error: "Não foi possível registrar o arquivo." };
  }
  revalidar();
  return { ok: true };
}
