/**
 * Contato público do canal — um lugar só para o telefone, para o rodapé, o botão
 * do WhatsApp e a página de privacidade nunca divergirem.
 *
 * O WhatsApp (`wa.me`) pede o número completo, só dígitos, com o código do país
 * (55) e o DDD. Se o número mudar, altere só `CONTACT_PHONE_E164` e
 * `CONTACT_PHONE_DISPLAY`.
 */
export const CONTACT_PHONE_E164 = "557599928638";
export const CONTACT_PHONE_DISPLAY = "+55 (75) 9992-8638";
/** Número do telefone da página de privacidade, sem o +55 (como já era escrito). */
export const CONTACT_PHONE_LOCAL = "(75) 9992-8638";

/** Mensagem que já vem escrita ao abrir a conversa: deixa claro que é uma dúvida, não um relato. */
export const WHATSAPP_DEFAULT_MESSAGE = "Olá! Tenho uma dúvida sobre o Canal de Denúncias.";

export function whatsappUrl(message: string = WHATSAPP_DEFAULT_MESSAGE): string {
  return `https://wa.me/${CONTACT_PHONE_E164}?text=${encodeURIComponent(message)}`;
}

export function telUrl(): string {
  return `tel:+${CONTACT_PHONE_E164}`;
}
