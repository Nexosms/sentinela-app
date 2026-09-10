import { publicEnv } from "@/lib/env";

/**
 * Link público que vai para os colaboradores da empresa-cliente relatarem.
 * Fora de `actions.ts` de propósito: um arquivo `"use server"` só pode
 * exportar funções assíncronas (viram Server Actions) — esta é síncrona e
 * também é usada direto em Server Components.
 */
export function relatoUrl(slug: string): string {
  return `${publicEnv.siteUrl}/relato/${slug}`;
}
