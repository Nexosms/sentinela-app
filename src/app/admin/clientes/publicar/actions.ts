"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
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
  resolveMime,
} from "@/lib/portal/files";
import { FOLDER_CATEGORY, MATERIAL_CATEGORIES, fromMonthYear } from "@/lib/portal/portal";
import { VERSAO_BUILD } from "@/lib/versao";

/**
 * Publicar o mesmo arquivo para VÁRIAS empresas de uma vez (só a equipe Nexo).
 *
 * Desenho: o arquivo sobe UMA vez para uma área temporária do bucket
 * (`_publicacao/`), e então cada empresa escolhida recebe a sua própria CÓPIA
 * (cópia feita dentro do Storage, sem baixar nem reenviar), com a linha de
 * `portal_files` apontando para ela. Cada empresa fica com um objeto próprio no
 * caminho `<org>/<uuid>.<ext>`, então apagar ou trocar o arquivo de uma não mexe
 * nas outras — é o mesmo contrato do cadastro individual.
 *
 * O trabalho é fatiado de propósito: UMA empresa por chamada
 * (`copiarParaEmpresa`), orquestrada pelo navegador. Copiar um vídeo grande para
 * 20 empresas numa chamada só estouraria o tempo de uma função da Vercel.
 *
 * Quem autoriza é a RLS (`app.is_nexo_admin()` nas policies de `portal_*`); o
 * `isNexoAdmin()` daqui é cortesia. Service role só para o Storage; toda
 * gravação em tabela vai sob RLS.
 */

export type Resultado = { ok: true } | { error: string };
export type UploadPublicacao = { path: string; token: string; mime: string } | { error: string };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const STAGING_RE = /^_publicacao\/[0-9a-f-]{36}\.[a-z0-9]+$/;
const CATEGORY_KEYS = MATERIAL_CATEGORIES.map(category => category.key) as [string, ...string[]];

type Contexto = { supabase: Awaited<ReturnType<typeof createClient>>; userId: string };

async function exigirNexo(): Promise<Contexto | { error: string }> {
  if (!(await isNexoAdmin())) return { error: "Só a equipe Nexo pode publicar no portal dos clientes." };
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  return { supabase: await createClient(), userId: user.id };
}

/** Versão do servidor que está respondendo — a tela compara com a da página aberta. */
export async function versaoDoServidor(): Promise<string> {
  return VERSAO_BUILD;
}

/** Passo 1: caminho + token para enviar UMA vez à área temporária. Só metadados — os bytes vão direto ao Storage. */
export async function solicitarUploadPublicacao(input: {
  filename: string;
  size: number;
  type: string;
}): Promise<UploadPublicacao> {
  const ctx = await exigirNexo();
  if ("error" in ctx) return ctx;

  const mime = resolveMime(input.filename, input.type);
  if (!mime) return { error: "Tipo de arquivo não aceito." };
  if (!Number.isFinite(input.size) || input.size <= 0) return { error: "Arquivo vazio." };
  if (input.size > PORTAL_MAX_BYTES) return { error: "Arquivo acima do limite de 2 GB." };

  const path = `_publicacao/${randomUUID()}.${extForMime(mime)}`;
  const { data, error } = await createAdminClient().storage.from(PORTAL_BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[publicar] createSignedUploadUrl: %s", error?.message ?? "sem retorno");
    return { error: "Não foi possível preparar o envio. Tente novamente." };
  }
  return { path, token: data.token, mime };
}

const destinoSchema = z.object({
  orgId: z.uuid(),
  stagingPath: z.string().regex(STAGING_RE),
  filename: z.string().min(1).max(255),
  modo: z.enum(["material", "pasta"]),
  // No modo pasta a categoria vai em branco (é sempre o CDN Conecta); só o material solto a usa.
  category: z.union([z.enum(CATEGORY_KEYS), z.literal("")]).optional(),
  title: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  publishedAt: z.union([z.literal(""), z.string().regex(DATA)]).optional(),
  isPublished: z.boolean(),
  pasta: z
    .object({
      name: z.string().trim().min(2, "Dê um nome à pasta.").max(200),
      month: z.string(),
      year: z.string(),
      description: z.string().trim().max(2000),
    })
    .optional(),
});

export type DestinoInput = z.input<typeof destinoSchema>;

function nomeSeguro(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "arquivo";
  return base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || "arquivo";
}

/**
 * Passo 2 (uma chamada por empresa e por arquivo): copia o arquivo temporário
 * para o caminho da empresa e publica. No modo pasta, acha a pasta da campanha
 * (mesmo nome e mês) ou cria — rodar de novo acrescenta arquivos à mesma pasta
 * em vez de duplicá-la.
 */
export async function copiarParaEmpresa(input: DestinoInput): Promise<Resultado> {
  const ctx = await exigirNexo();
  if ("error" in ctx) return ctx;

  const parsed = destinoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const { data: org } = await ctx.supabase.from("organizations").select("id").eq("id", dados.orgId).maybeSingle();
  if (!org) return { error: "Empresa não encontrada." };

  if (dados.modo === "material") {
    if (!dados.category) return { error: "Escolha a categoria." };
    if (!dados.title) return { error: "Dê um título ao material." };
  } else if (!dados.pasta) {
    return { error: "Informe a pasta." };
  }

  // O que chegou ao Storage é que vale, não o que o navegador declarou.
  const admin = createAdminClient();
  const { data: info, error: infoError } = await admin.storage.from(PORTAL_BUCKET).info(dados.stagingPath);
  if (infoError || !info) return { error: "O arquivo temporário não foi encontrado. Envie de novo." };
  const size = info.size ?? 0;
  const mime = (info.contentType ?? "").toLowerCase().split(";")[0].trim();
  if (size <= 0) return { error: "Arquivo vazio." };
  if (!isAllowedMime(mime)) return { error: "Tipo de arquivo não aceito." };

  const filename = nomeSeguro(dados.filename);
  let category: string;
  let folderId: string | null = null;
  let title: string;

  if (dados.modo === "pasta" && dados.pasta) {
    const referenceMonth = fromMonthYear(dados.pasta.month, dados.pasta.year);
    if (!referenceMonth) return { error: "Informe o mês e o ano da campanha." };

    const { data: existente } = await ctx.supabase
      .from("portal_folders")
      .select("id")
      .eq("org_id", dados.orgId)
      .eq("category", FOLDER_CATEGORY)
      .eq("name", dados.pasta.name)
      .eq("reference_month", referenceMonth)
      .limit(1)
      .maybeSingle();
    if (existente) {
      folderId = existente.id;
    } else {
      const { data: criada, error } = await ctx.supabase
        .from("portal_folders")
        .insert({
          org_id: dados.orgId,
          category: FOLDER_CATEGORY,
          name: dados.pasta.name,
          reference_month: referenceMonth,
          description: dados.pasta.description || null,
          is_published: dados.isPublished,
          created_by: ctx.userId,
        })
        .select("id")
        .maybeSingle();
      if (error || !criada) {
        console.error("[publicar] criar pasta: %s", error?.message ?? "insert sem retorno");
        return { error: "Não foi possível criar a pasta." };
      }
      folderId = criada.id;
    }
    category = FOLDER_CATEGORY;
    title = filename.replace(/\.[^.]+$/, "").slice(0, 200) || filename;
  } else {
    category = dados.category as string;
    title = dados.title as string;
  }

  const destino = `${dados.orgId}/${randomUUID()}.${extForMime(mime)}`;
  const { error: copyError } = await admin.storage.from(PORTAL_BUCKET).copy(dados.stagingPath, destino);
  if (copyError) {
    console.error("[publicar] copiar objeto: %s", copyError.message);
    return { error: "Não foi possível copiar o arquivo para esta empresa." };
  }

  const { error: insertError } = await ctx.supabase.from("portal_files").insert({
    org_id: dados.orgId,
    kind: "material",
    folder_id: folderId,
    category,
    title,
    description: dados.description || null,
    published_at: dados.publishedAt || todayInSaoPaulo(),
    storage_path: destino,
    filename,
    mime_type: mime,
    size_bytes: size,
    // Dentro de pasta a visibilidade é da pasta; solto, é do próprio material.
    is_published: folderId ? true : dados.isPublished,
    created_by: ctx.userId,
  });
  if (insertError) {
    console.error("[publicar] registrar arquivo: %s", insertError.message);
    // Sem linha, a cópia ficaria órfã.
    await admin.storage.from(PORTAL_BUCKET).remove([destino]);
    return { error: "Não foi possível registrar o arquivo nesta empresa." };
  }

  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Passo 3: apaga os arquivos temporários (depois de todas as cópias, ou ao descartar). */
export async function limparPublicacao(paths: string[]): Promise<Resultado> {
  const ctx = await exigirNexo();
  if ("error" in ctx) return ctx;

  const validos = paths.filter(path => STAGING_RE.test(path));
  if (validos.length === 0) return { ok: true };
  const { error } = await createAdminClient().storage.from(PORTAL_BUCKET).remove(validos);
  if (error) {
    console.error("[publicar] limpar temporários: %s", error.message);
    return { error: "Não foi possível limpar os arquivos temporários." };
  }
  return { ok: true };
}
