"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Helpers de rótulo e erro, copiados verbatim do protótipo (`ReportChannel.tsx`, l. 96–104).
 *  As classes `.field-title`, `.info-hint` e `.field-error-message` já existem
 *  no design system. */

/**
 * Círculo "i" clicável. Era um `<span title=…>` (tooltip nativo, só no hover
 * do mouse — em toque não mostra nada, o que os denunciantes de celular
 * relataram). Agora é um `<button>` de verdade que abre/fecha um texto
 * visível, funciona em toque e teclado.
 *
 * `preventDefault`/`stopPropagation` no clique: todo uso deste componente
 * vive dentro de um `<label>` de campo — sem isso, o clique "vazaria" para o
 * `<label>` e focaria/abriria o campo ao lado sem querer.
 */
export function InfoHint({ label, info }: { label: string; info: string }) {
  const [open, setOpen] = useState(false);
  const holderRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  // Tocar ou clicar fora fecha sozinho — sem isso, numa lista longa de opções
  // (cada uma com o próprio "i"), o balão anterior ficaria aberto empurrando
  // visualmente o próximo. `pointerdown` cobre mouse e toque com um só listener,
  // e só existe enquanto `open`, então não interfere no toque que abre o balão.
  useEffect(() => {
    if (!open) return;
    function onOutside(event: PointerEvent) {
      if (holderRef.current && !holderRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  // O balão nasce alinhado à esquerda do "i" (CSS `left:0`). Quando o "i" está
  // perto da borda da tela (como nas opções de categoria, cujo rótulo empurra
  // o ícone para a direita), isso faria o texto ser cortado ou sobrepor o item
  // seguinte. Corrige deslocando o balão para caber na tela, antes da pintura
  // (`useLayoutEffect`), sem depender de onde o componente é usado.
  useLayoutEffect(() => {
    if (!open) return;
    const bubble = bubbleRef.current;
    if (!bubble) return;
    bubble.style.left = "0";
    const rect = bubble.getBoundingClientRect();
    // `clientWidth`, não `window.innerWidth`: em alguns navegadores/emulações
    // de toque os dois divergem, e é `clientWidth` que corresponde à largura
    // de fato disponível para o layout (o que decide se o balão cabe).
    const viewportWidth = document.documentElement.clientWidth;
    const margin = 12;
    if (rect.right > viewportWidth - margin) {
      bubble.style.left = `${viewportWidth - margin - rect.right}px`;
    } else if (rect.left < margin) {
      bubble.style.left = `${margin - rect.left}px`;
    }
  }, [open]);

  return (
    <span className="info-hint-holder" ref={holderRef}>
      <button
        type="button"
        className="info-hint"
        aria-expanded={open}
        aria-label={`Informação sobre ${label}`}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(o => !o);
        }}
      >
        i
      </button>
      {open ? (
        <span className="info-hint-bubble" role="tooltip" ref={bubbleRef}>
          {info}
        </span>
      ) : null}
    </span>
  );
}

export function FieldTitle({
  label,
  info,
  required = true,
}: {
  label: string;
  info: string;
  required?: boolean;
}) {
  return (
    <span className="field-title">
      {label}
      {required && <b aria-hidden="true">*</b>}
      <InfoHint label={label} info={info} />
    </span>
  );
}

export function FieldError({ message }: { message?: string }) {
  return message ? (
    <small className="field-error-message" role="alert">
      {message}
    </small>
  ) : null;
}
