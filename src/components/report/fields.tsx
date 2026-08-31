"use client";

/** Helpers de rótulo e erro, copiados verbatim do protótipo (_legacy, l. 96–104).
 *  As classes `.field-title`, `.info-hint` e `.field-error-message` já existem
 *  no design system. */

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
      <span
        className="info-hint"
        tabIndex={0}
        role="img"
        aria-label={`Informação sobre ${label}`}
        title={info}
      >
        i
      </span>
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
