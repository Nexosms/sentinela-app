"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { isNexoAdmin } from "@/lib/org/context";
import {
  gerarRelatorioMensal,
  gravarRascunho,
  listarEmpresasCliente,
} from "@/lib/admin/relatorioMensal";
import { MONTHLY_KIND, isMes, limitesDoMes } from "@/lib/admin/relatorioMensalTipos";

/**
 * Gestão do relatório mensal pela equipe Nexo: gerar o rascunho, conferir,
 * liberar ao cliente (um a um ou todos) e ocultar.
 *
 * Quem autoriza de verdade é a RLS (`snapshots_*` exigem `app.is_nexo_admin()`);
 * o `isNexoAdmin()` daqui é cortesia. Service role só para CALCULAR (o Comitê e
 * até a RLS da empresa não enxergam `reports`); liberar e ocultar vão sob RLS,
 * para a trilha de auditoria registrar a pessoa e não "sistema".
 *
 * Cada ação termina em `redirect` com um aviso na querystring — o formulário é
 * HTML puro, sem JavaScript, e a tela mostra o resultado.
 */

const LISTA = "/admin/clientes/relatorios";

const entrada = z.object({
  mes: z.string().refine(isMes, "Mês inválido."),
  orgId: z.uuid().optional(),
});

function voltar(mes: string, aviso: string): never {
  redirect(`${LISTA}?mes=${mes}&aviso=${aviso}`);
}

async function exigirNexo(mes: string) {
  if (!(await isNexoAdmin())) voltar(mes, "negado");
  const user = await getAuthenticatedUser();
  if (!user) voltar(mes, "sessao");
  return { userId: user.id };
}

function ler(formData: FormData) {
  const parsed = entrada.safeParse({
    mes: formData.get("mes"),
    orgId: formData.get("orgId") || undefined,
  });
  if (!parsed.success) redirect(LISTA);
  return parsed.data;
}

/** Gera (ou regera) UM rascunho. Relatório já publicado não é sobrescrito. */
export async function gerarRelatorio(formData: FormData) {
  const { mes, orgId } = ler(formData);
  const ctx = await exigirNexo(mes);
  if (!orgId) voltar(mes, "erro");

  const admin = createAdminClient();
  const empresas = await listarEmpresasCliente(admin);
  if (!empresas.some(empresa => empresa.id === orgId)) voltar(mes, "erro");

  let resultado;
  try {
    const metrics = await gerarRelatorioMensal(admin, orgId, mes);
    resultado = await gravarRascunho(admin, orgId, metrics, ctx.userId);
  } catch {
    voltar(mes, "erro");
  }
  revalidatePath(LISTA);
  if (!resultado.ok) voltar(mes, resultado.motivo === "publicado" ? "ja-publicado" : "erro");
  voltar(mes, "gerado");
}

/** Gera o que falta no mês para todas as empresas ativas (o que o cron faz no dia 1º). */
export async function gerarFaltantes(formData: FormData) {
  const { mes } = ler(formData);
  const ctx = await exigirNexo(mes);
  const { inicio, fim } = limitesDoMes(mes);

  const admin = createAdminClient();
  const empresas = (await listarEmpresasCliente(admin)).filter(empresa => empresa.ativa);
  const { data: existentes } = await admin
    .from("report_snapshots")
    .select("org_id")
    .eq("kind", MONTHLY_KIND)
    .eq("period_start", inicio)
    .eq("period_end", fim);
  const jaTem = new Set((existentes ?? []).map(linha => linha.org_id));

  let gerados = 0;
  let falhas = 0;
  for (const empresa of empresas) {
    if (jaTem.has(empresa.id)) continue;
    try {
      const metrics = await gerarRelatorioMensal(admin, empresa.id, mes);
      const gravado = await gravarRascunho(admin, empresa.id, metrics, ctx.userId);
      if (gravado.ok) gerados += 1;
      else falhas += 1;
    } catch {
      falhas += 1;
    }
  }
  revalidatePath(LISTA);
  voltar(mes, falhas > 0 ? `gerados-${gerados}-falhas-${falhas}` : `gerados-${gerados}`);
}

async function atualizarPublicacao(mes: string, userId: string, orgId: string | undefined, publicar: boolean) {
  const { inicio, fim } = limitesDoMes(mes);
  const supabase = await createClient();
  let consulta = supabase
    .from("report_snapshots")
    .update(
      publicar
        ? { is_published: true, published_at: new Date().toISOString(), published_by: userId }
        : { is_published: false, published_at: null, published_by: null },
    )
    .eq("kind", MONTHLY_KIND)
    .eq("period_start", inicio)
    .eq("period_end", fim)
    .eq("is_published", !publicar);
  if (orgId) consulta = consulta.eq("org_id", orgId);
  const { data, error } = await consulta.select("id");
  if (error) {
    console.error("[relatório mensal] %s: %s", publicar ? "liberar" : "ocultar", error.message);
    return null;
  }
  return data?.length ?? 0;
}

export async function liberarRelatorio(formData: FormData) {
  const { mes, orgId } = ler(formData);
  const ctx = await exigirNexo(mes);
  if (!orgId) voltar(mes, "erro");
  const quantos = await atualizarPublicacao(mes, ctx.userId, orgId, true);
  revalidatePath(LISTA);
  revalidatePath("/admin/relatorios");
  voltar(mes, quantos ? "liberado" : "erro");
}

export async function liberarTodos(formData: FormData) {
  const { mes } = ler(formData);
  const ctx = await exigirNexo(mes);
  const quantos = await atualizarPublicacao(mes, ctx.userId, undefined, true);
  revalidatePath(LISTA);
  revalidatePath("/admin/relatorios");
  voltar(mes, quantos === null ? "erro" : `liberados-${quantos}`);
}

export async function ocultarRelatorio(formData: FormData) {
  const { mes, orgId } = ler(formData);
  const ctx = await exigirNexo(mes);
  if (!orgId) voltar(mes, "erro");
  const quantos = await atualizarPublicacao(mes, ctx.userId, orgId, false);
  revalidatePath(LISTA);
  revalidatePath("/admin/relatorios");
  voltar(mes, quantos ? "ocultado" : "erro");
}
