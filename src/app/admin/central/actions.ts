"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { listarEmpresasDaCentral } from "@/lib/admin/central";
import { ACTIVE_ORG_COOKIE } from "@/lib/org/context";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Abre um relato a partir da Central: entra na empresa dele e vai para o caso.
 *
 * Não cria acesso: só aceita empresa que a própria Central lista (vínculo ativo + "Denúncias"
 * liberada para o papel), e quem decide se o caso abre é a página do caso, sob RLS — como sempre.
 * O valor vem como `empresa:relato` num único botão, porque a tabela inteira é um só formulário.
 */
export async function abrirCaso(formData: FormData) {
  const [orgId, reportId] = String(formData.get("caso") ?? "").split(":");
  if (!orgId || !reportId || !UUID.test(orgId) || !UUID.test(reportId)) redirect("/admin/central");

  const empresas = await listarEmpresasDaCentral();
  if (!empresas.some(org => org.orgId === orgId)) redirect("/admin/central");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/admin", "layout");
  redirect(`/admin/denuncias/${reportId}`);
}
