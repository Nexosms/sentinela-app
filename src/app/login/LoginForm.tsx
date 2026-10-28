"use client";

import { useActionState, useId, useState } from "react";

import { Alert, ArrowRight, Eye, EyeOff, Key, Mail } from "@/components/public/icons";
import { signIn, type LoginState } from "@/lib/auth/actions";

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const emailId = useId();
  const passwordId = useId();
  const [showPassword, setShowPassword] = useState(false);
  // Cada tentativa remonta o aviso de erro, para a animação rodar de novo mesmo com a mesma mensagem.
  const [attempt, setAttempt] = useState(0);

  return (
    <form action={action} onSubmit={() => setAttempt(value => value + 1)}>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="lg-field">
        <label htmlFor={emailId} className="lg-label">
          <span className="lg-ic" aria-hidden="true">
            <Mail size={19} />
          </span>
          E-mail corporativo
        </label>
        <input
          id={emailId}
          className="lg-input"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="voce@empresa.com.br"
        />
      </div>

      <div className="lg-field">
        <label htmlFor={passwordId} className="lg-label">
          <span className="lg-ic" aria-hidden="true">
            <Key size={19} />
          </span>
          Senha
        </label>
        <div className="lg-wrap">
          <input
            id={passwordId}
            className="lg-input"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="lg-eye"
            onClick={() => setShowPassword(value => !value)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Ocultar a senha" : "Mostrar a senha"}
          >
            {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
      </div>

      {state.error ? (
        <div key={attempt} className="lg-error" role="alert">
          <Alert size={18} />
          <span>{state.error}</span>
        </div>
      ) : null}

      <button className="lg-submit" type="submit" disabled={pending}>
        <span>{pending ? "Entrando…" : "Entrar"}</span>
        <span className="lg-arrow">
          <ArrowRight />
        </span>
      </button>
    </form>
  );
}
