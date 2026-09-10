"use client";

import { useActionState } from "react";

import { editarEmpresaCliente, type EditState } from "@/app/admin/clientes/actions";
import { formatCnpj } from "@/lib/admin/configuracoes";

const EMPTY: EditState = {};

export default function EditarClienteForm({
  org,
}: {
  org: { id: string; tradeName: string; legalName: string; cnpj: string | null };
}) {
  const [state, action, pending] = useActionState(editarEmpresaCliente, EMPTY);

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={org.id} />
      <div className="field-grid two">
        <label>
          Nome fantasia
          <input name="tradeName" required maxLength={120} defaultValue={org.tradeName} />
        </label>
        <label>
          Razão social
          <input name="legalName" required maxLength={160} defaultValue={org.legalName} />
        </label>
        <label>
          CNPJ
          <input name="cnpj" maxLength={18} defaultValue={org.cnpj ? formatCnpj(org.cnpj) : ""} />
        </label>
      </div>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
      {state.ok ? (
        <div className="care-note">
          <span>✓</span>
          <div>
            <strong>Salvo</strong>
          </div>
        </div>
      ) : null}
      <div className="case-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar alterações"} <span>→</span>
        </button>
      </div>
    </form>
  );
}
