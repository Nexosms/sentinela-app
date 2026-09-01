"use server";

import { revalidatePath } from "next/cache";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { getStaffContext } from "@/lib/org/context";

export type MarkReadState = { ok?: true; error?: string };

/**
 * Marca notificações como lidas.
 *
 * A policy de UPDATE de `notifications` é da organização inteira — ela existe
 * para permitir a marcação, não para dizer o que é meu. Por isso o escopo do
 * destinatário é explícito aqui, em dois updates separados: as endereçadas a
 * mim e as do meu papel. Sem isso, um `update ... is null` marcaria como lida a
 * caixa de todo mundo da organização.
 *
 * Notificação de papel tem um `read_at` só: quando alguém da triagem a lê, ela
 * some para a triagem inteira. É o comportamento do esquema, não um descuido.
 */
export async function marcarComoLidas(formData: FormData): Promise<MarkReadState> {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const staff = await getStaffContext();
  const supabase = await createClient();
  const id = formData.get("id");
  const now = new Date().toISOString();

  const mine = supabase
    .from("notifications")
    .update({ read_at: now })
    .is("read_at", null)
    .eq("user_id", user.id);

  const byRole = supabase
    .from("notifications")
    .update({ read_at: now })
    .is("read_at", null)
    .is("user_id", null)
    .contains("target_roles", [staff.role]);

  if (typeof id === "string" && id.length > 0) {
    mine.eq("id", id);
    byRole.eq("id", id);
  }

  const [a, b] = await Promise.all([mine, byRole]);
  const error = a.error ?? b.error;
  if (error) {
    console.error("[notificações] marcar como lida: %s", error.message);
    return { error: "Não foi possível marcar como lida." };
  }

  revalidatePath("/admin/notificacoes");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
