"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CloseIcon, ShieldCheck, WhatsAppIcon } from "@/components/public/icons";
import { whatsappUrl } from "@/lib/contact";

/**
 * Bolinha de WhatsApp das etapas do relato. Diferente da tela inicial, o clique não abre o
 * WhatsApp direto: o canal promete anonimato e o WhatsApp mostra o número de quem escreve, então
 * um aviso curto vem antes. O link abre sem `referrer`, para a URL do formulário (que traz a
 * empresa) não seguir junto.
 */
export default function WizardWhatsApp() {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (!dialogRef.current?.contains(target) && !buttonRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div className="wz-wa-wrap">
      {open ? (
        <div
          ref={dialogRef}
          className="wz-wa-pop"
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
        >
          <button type="button" className="wz-wa-x" onClick={close} aria-label="Fechar">
            <CloseIcon size={18} />
          </button>
          <span className="wz-wa-pic" aria-hidden="true">
            <ShieldCheck size={20} />
          </span>
          <h2 id={titleId}>Dúvidas sobre o canal?</h2>
          <p>
            Pelo WhatsApp você fala com a nossa equipe. Tenha em mente que{" "}
            <b>o WhatsApp mostra o seu número de telefone</b> a quem atende.
          </p>
          <p className="wz-wa-tip">
            Para manter o relato anônimo, use o WhatsApp só para dúvidas gerais e escreva o seu relato
            aqui, neste formulário.
          </p>
          <div className="wz-wa-actions">
            <a
              className="wz-wa-go"
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              Abrir o WhatsApp
            </a>
            <button type="button" className="wz-wa-no" onClick={close}>
              Agora não
            </button>
          </div>
        </div>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className="wz-wa"
        aria-expanded={open}
        aria-label="Tirar dúvidas pelo WhatsApp"
        onClick={() => setOpen(value => !value)}
      >
        <span className="wz-wa-ic">
          <WhatsAppIcon size={32} />
        </span>
        <span className="wz-wa-label" aria-hidden="true">
          Tirar uma dúvida
        </span>
      </button>
    </div>
  );
}
