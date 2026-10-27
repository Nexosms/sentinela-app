import { whatsappUrl } from "@/lib/contact";

import { WhatsAppIcon } from "./icons";

/**
 * Botão flutuante do WhatsApp (canto inferior direito). Só na tela inicial: no
 * formulário de relato e no acompanhamento de protocolo ele não aparece, porque
 * o WhatsApp mostra o número de quem escreve e o canal promete anonimato.
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
