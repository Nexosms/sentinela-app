"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Mic } from "@/components/public/icons";

/**
 * Aviso de privacidade antes do primeiro uso do ditado. Renderizado no <body>
 * (portal) — o cartão do formulário usa `backdrop-filter`, que "prende" elementos
 * `position: fixed` dentro dele. Foco vai para o botão principal, Esc equivale a
 * "Prefiro digitar" e o Tab fica preso entre os dois botões.
 */
export default function DictationConsent({
  onAccept,
  onDecline,
}: {
  onAccept: () => void;
  onDecline: () => void;
}) {
  const accept = useRef<HTMLButtonElement>(null);
  const decline = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    accept.current?.focus();
    const previous = document.activeElement as HTMLElement | null;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onDecline();
        return;
      }
      if (event.key !== "Tab") return;
      const first = decline.current;
      const last = accept.current;
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onDecline]);

  return createPortal(
    <div className="wz-veil">
      <div
        className="wz-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wz-dictation-title"
        aria-describedby="wz-dictation-text"
      >
        <span className="wz-dialog-icon">
          <Mic size={24} />
        </span>
        <h3 id="wz-dictation-title">Antes de usar a voz</h3>
        <p id="wz-dictation-text">
          O ditado é feito pelo <b>seu navegador ou aparelho</b>. Para transcrever, ele pode enviar o
          áudio ao fabricante (por exemplo, Google ou Apple).
        </p>
        <ul>
          <li>
            O canal <b>não recebe nem guarda o áudio</b>: só o texto que aparece na caixa.
          </li>
          <li>
            Você pode <b>corrigir o texto</b> antes de continuar.
          </li>
          <li>
            Se preferir não usar, é só <b>digitar</b> normalmente.
          </li>
        </ul>
        <div className="wz-dialog-actions">
          <button type="button" className="wz-dialog-no" ref={decline} onClick={onDecline}>
            Prefiro digitar
          </button>
          <button type="button" className="wz-dialog-yes" ref={accept} onClick={onAccept}>
            Entendi, usar a voz
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
