"use client";

import { useState } from "react";

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
  return (
    <span className="info-hint-holder">
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
        <span className="info-hint-bubble" role="tooltip">
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
