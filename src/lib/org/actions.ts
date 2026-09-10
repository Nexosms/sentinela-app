"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { ACTIVE_ORG_COOKIE } from "./context";

/**
 * Troca qual organização `getStaffContext()` resolve, para quem (hoje só a
 * equipe Nexo) tem vínculo ativo em mais de uma. Confirma o vínculo antes de
 * gravar o cookie — nunca confia num `orgId` vindo do formulário sem checar
 * sob RLS.
 */
export async function trocarOrganizacaoAtiva(formData: FormData) {
  const orgId = String(formData.get("orgId") ?? "");
  const user = await getAuthenticatedUser();
  if (!user || !orgId) redirect("/admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("org_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();

  if (data) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  revalidatePath("/admin", "layout");
  redirect("/admin");
}
