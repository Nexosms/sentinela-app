import { whatsappUrl } from "@/lib/contact";

import { WhatsAppIcon } from "./icons";

/**
 * Botão flutuante do WhatsApp (canto inferior direito) da tela inicial. O WhatsApp mostra o
 * número de quem escreve e o canal promete anonimato, então o formulário de relato usa outra
 * versão, com aviso antes de abrir (`report/WizardWhatsApp`); o acompanhamento não tem botão.
 * A conversa já abre com uma mensagem de "dúvida sobre o canal".
 */
export default function WhatsAppFloat() {
  return (
    <a
      className="hm-wa"
      href={whatsappUrl()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar pelo WhatsApp (dúvidas sobre o canal). Abre em uma nova janela."
    >
      <span className="hm-wa-ic">
        <WhatsAppIcon size={32} />
      </span>
      <span className="hm-wa-label" aria-hidden="true">
        Falar pelo WhatsApp
      </span>
    </a>
  );
}
