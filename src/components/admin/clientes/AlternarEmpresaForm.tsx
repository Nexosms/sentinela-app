"use client";

import { useActionState } from "react";

import { alternarEmpresaCliente, type EditState } from "@/app/admin/clientes/actions";

const EMPTY: EditState = {};

/** Ativar/desativar. Não há DELETE: cada evento de auditoria da empresa aponta para ela. */
export default function AlternarEmpresaForm({
  orgId,
  tradeName,
  isActive,
}: {
  orgId: string;
  tradeName: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(alternarEmpresaCliente, EMPTY);

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="ativar" value={isActive ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        title={isActive ? "Desativar empresa" : "Reativar empresa"}
        aria-label={`${isActive ? "Desativar" : "Reativar"} a empresa ${tradeName}`}
      >
        {isActive ? "⊘" : "⟳"}
      </button>
      {state.error ? <small className="field-error-message">{state.error}</small> : null}
    </form>
  );
}
