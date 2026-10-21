"use client";

import { useActionState } from "react";
import Link from "next/link";

import { solicitarRedefinicao, type RecuperarState } from "@/lib/auth/actions";

export default function EsqueciForm() {
  const [state, action, pending] = useActionState<RecuperarState, FormData>(solicitarRedefinicao, {});

  if (state.enviado) {
    return (
      <>
        <div className="privacy-note" role="status">
          <b>Pedido recebido</b>
          <p>
            Se este e-mail tem acesso ao painel, enviamos um link para criar uma nova senha. Ele vale por
            tempo limitado e serve uma vez só. Confira também a caixa de spam.
          </p>
        </div>
        <p>
          <Link className="quiet-link" href="/login">
            Voltar para a tela de acesso
          </Link>
        </p>
      </>
    );
  }

  return (
    <form action={action}>
      <label>
        E-mail corporativo
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="voce@empresa.com.br"
        />
      </label>
      {state.error ? <div className="form-error">{state.error}</div> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link de redefinição"} <span>→</span>
      </button>
      <p>
        <Link className="quiet-link" href="/login">
          Voltar para a tela de acesso
        </Link>
      </p>
    </form>
  );
}
