"use client";

import { useActionState, useState } from "react";

import { convidarContatoCliente, type ActionState } from "@/app/admin/clientes/actions";

const EMPTY: ActionState = {};

/**
 * Convida o contato de uma empresa-cliente que foi cadastrada sem um —
 * mesmo papel (Comitê) e mesmo link de acesso do cadastro original, só que
 * a qualquer momento depois, sem precisar entrar na organização primeiro.
 */
export default function ConvidarContatoForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState(convidarContatoCliente, EMPTY);
  const [copiado, setCopiado] = useState(false);

  if (state.ok) {
    return (
      <div className="care-note">
        <span>✓</span>
        <div>
          <strong>
            {state.emailSent ? "Convite enviado por e-mail" : "Convite criado — o e-mail NÃO foi enviado"}
          </strong>
          {state.inviteUrl ? (
            <>
              <small>
                Vale por tempo limitado e serve uma vez — mande por um canal que você confie.
              </small>
              <label className="wide-field" style={{ marginTop: 10 }}>
                Link de acesso
                <textarea readOnly rows={3} value={state.inviteUrl} aria-label="Link de acesso do contato" />
              </label>
              <div className="case-actions">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(state.inviteUrl ?? "");
                    setCopiado(true);
                  }}
                >
                  {copiado ? "Link copiado ✓" : "Copiar link"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={orgId} />
      <div className="field-grid two">
        <label>
          Nome do contato
          <input name="contactName" required maxLength={120} placeholder="Nome e sobrenome" />
        </label>
        <label>
          E-mail do contato
          <input name="contactEmail" type="email" required maxLength={320} placeholder="pessoa@empresa.com.br" />
        </label>
      </div>
      {state.error ? <span className="field-error-message">{state.error}</span> : null}
      <div className="case-actions">
        <button className="primary-button" type="submit" disabled={pending}>
          {pending ? "Convidando…" : "Convidar contato"} <span>→</span>
        </button>
      </div>
    </form>
  );
}
