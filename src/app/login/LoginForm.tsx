"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/lib/auth/actions";

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={action}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
      <label>
        Senha
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? <div className="form-error">{state.error}</div> : null}
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"} <span>→</span>
      </button>
    </form>
  );
}
