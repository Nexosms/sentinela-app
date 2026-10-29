import { useSyncExternalStore } from "react";

/**
 * Lembra, só na aba aberta, de qual empresa é o link que a pessoa usou
 * (`/relato/<slug>`). Quem sai do formulário para o início e clica em "Fazer um
 * relato" volta para a mesma empresa, em vez de cair no canal padrão.
 *
 * `sessionStorage`, não `localStorage`: some ao fechar a aba e não deixa no
 * aparelho nenhum rastro de que alguém abriu o canal. Guarda só o slug da
 * empresa, nunca nada do relato.
 */

const CHAVE = "sentinela.empresa";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Só slug bem-formado vira link; qualquer outra coisa guardada na aba é ignorada. */
export function slugValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length <= 80 && SLUG.test(valor);
}

export function lembrarEmpresa(slug: string): void {
  if (!slugValido(slug)) return;
  try {
    window.sessionStorage.setItem(CHAVE, slug);
  } catch {
    // Armazenamento bloqueado (aba privada, política do navegador): segue sem lembrar.
  }
}

export function lerEmpresaLembrada(): string | null {
  try {
    const valor = window.sessionStorage.getItem(CHAVE);
    return slugValido(valor) ? valor : null;
  } catch {
    return null;
  }
}

function semAssinatura() {
  return () => {};
}

/** `null` no servidor e na hidratação; o valor da aba aparece logo depois, sem `setState` em efeito. */
export function useEmpresaLembrada(): string | null {
  return useSyncExternalStore(semAssinatura, lerEmpresaLembrada, () => null);
}

/** Caminho do relato da empresa lembrada, ou `/relato` (que pede o link da empresa) se não houver. */
export function caminhoDoRelato(slug: string | null): string {
  return slug ? `/relato/${slug}` : "/relato";
}
