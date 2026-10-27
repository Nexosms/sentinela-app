import Link from "next/link";

import Brand from "@/components/brand/Brand";
import { CONTACT_PHONE_DISPLAY, telUrl, whatsappUrl } from "@/lib/contact";

import { Phone, WhatsAppIcon } from "./icons";

export default function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="hm-footer">
      <div className="hm-footer-grid">
        <div className="hm-footer-brand">
          <Brand />
          <p>
            Canal de denúncias operado com independência, privacidade e conformidade à Lei nº
            14.457/2022 e às NR-01, NR-05 e NR-17.
          </p>
        </div>
        <div className="hm-footer-col">
          <small>CONTATO</small>
          <a className="hm-tel" href={telUrl()}>
            <Phone size={17} />
            {CONTACT_PHONE_DISPLAY}
          </a>
          <a className="hm-wpp" href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon size={22} />
            Falar pelo WhatsApp
            <span className="hm-sr-only"> (abre em uma nova janela)</span>
          </a>
          <p className="hm-note">
            Para dúvidas sobre o canal. Para relatar, use o formulário: assim você pode manter o
            anonimato.
          </p>
          <span className="hm-cnpj">CNPJ 68.843.115/0001-81</span>
        </div>
        <div className="hm-footer-col">
          <small>INSTITUCIONAL</small>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/acessibilidade">Acessibilidade</Link>
          <Link href="/admin">Área administrativa</Link>
        </div>
      </div>
      <div className="hm-footer-bottom">
        <span>© {year} Canal de Prevenção e Gestão de Riscos Organizacionais Ltda.</span>
        <span>Canal operado com independência e privacidade desde a concepção.</span>
      </div>
    </footer>
  );
}
