import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

/**
 * Contagens da Visão geral para o Comitê.
 *
 * O Comitê NÃO lê relatos (a RLS de `reports` não o admite) e continua sem ler. A função
 * `public.rel_visao_geral_comite` (migração 044) devolve só números, para quem é Comitê da empresa, com
 * a mesma proteção de célula pequena do relatório mensal: `null` quer dizer "protegido", não "zero".
 *
 * Se a função não existir ainda, ou recusar, devolve `null` e a tela mostra "indisponível" — nunca
 * zeros inventados.
 */

const celula = z.number().int().nullable();

const contagensSchema = z.object({
  minimo: z.number().int(),
  /** Sempre exato. */
  total: z.number().int(),
  abertos: celula,
  encerrados: celula,
  criticos: celula,
  por_status: z.object({
    em_triagem: celula,
    em_apuracao: celula,
    aguardando_informacao: celula,
    concluida: celula,
    arquivada: celula,
  }),
});

export type ContagensComite = z.infer<typeof contagensSchema>;

type RpcClient = {
  rpc(
    fn: "rel_visao_geral_comite",
    args: { p_org: string },
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export async function carregarContagensComite(orgId: string): Promise<ContagensComite | null> {
  const supabase = await createClient();
  // O cast vai no CLIENTE INTEIRO, nunca no método (`const rpc = supabase.rpc` perde o `this`).
  const client = supabase as unknown as RpcClient;
  const { data, error } = await client.rpc("rel_visao_geral_comite", { p_org: orgId });
  if (error) {
    console.error("[comitê] rel_visao_geral_comite: %s", error.message);
    return null;
  }
  const parsed = contagensSchema.safeParse(data);
  if (!parsed.success) {
    console.error("[comitê] rel_visao_geral_comite: formato inesperado");
    return null;
  }
  return parsed.data;
}
