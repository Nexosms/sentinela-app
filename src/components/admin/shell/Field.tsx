import type { ReactNode } from "react";

/**
 * O bloco de campo do `<aside>` do detalhe: `<div><small>RÓTULO</small><strong>valor</strong></div>`.
 * O CSS (`.detail-columns aside div`) mira exatamente essa forma — por isso ela
 * vira componente em vez de ser recopiada em cada painel.
 *
 * Mora em `shell/` porque não sabe nada de denúncia nem de investigação.
 */
export default function Field({
  label,
  value,
  danger,
}: {
  label: string;
  value: ReactNode;
  /** `.danger` é a única cor que o design system dá a um valor: prazo vencido. */
  danger?: boolean;
}) {
  return (
    <div>
      <small>{label}</small>
      <strong className={danger ? "danger" : undefined}>{value}</strong>
    </div>
  );
}
