"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

const credentials = z.object({
  email: z.email("Informe um e-mail válido.").max(320),
  password: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

export type LoginState = { error?: string };

/** Só caminho relativo do próprio site; nunca um destino externo. */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/admin";
  return value;
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // Mensagem única: não revelar se o e-mail existe.
  if (error) return { error: "E-mail ou senha incorretos." };

  revalidatePath("/", "layout");
  redirect(safeNext(parsed.data.next));
}

export type RecuperarState = { enviado?: boolean; error?: string };

/**
 * "Esqueci minha senha". A resposta é SEMPRE a mesma — exista a conta ou não,
 * tenha o envio funcionado ou não — para a tela não virar um jeito de descobrir
 * quem tem acesso ao painel. O erro real só vai para o log.
 *
 * O e-mail leva ao NOSSO domínio (`/redefinir-senha?token_hash=…`, template do
 * Supabase), nunca à URL de verificação do Supabase: prévias de WhatsApp/Slack
 * gastariam o token de uso único. O próprio Supabase limita um pedido por
 * e-mail a cada 60 segundos.
 */
export async function solicitarRedefinicao(
  _prev: RecuperarState,
  formData: FormData,
): Promise<RecuperarState> {
  const parsed = z.object({ email: z.email("Informe um e-mail válido.").max(320) }).safeParse({
    email: String(formData.get("email") ?? "").trim(),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Informe um e-mail válido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/redefinir-senha`,
  });
  if (error) console.error("[auth] resetPasswordForEmail (%s): %s", error.code ?? "?", error.message);

  return { enviado: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
