"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ROLE_DESCRIPTION, ROLE_ORDER } from "@/lib/admin/configuracoes";
import { roleLabel } from "@/lib/admin/labels";

/**
 * Convite de equipe. Fala com `POST /api/admin/invites` por `fetch` em vez de
 * Server Action por um motivo concreto: só uma rota de API pode importar o
 * cliente service role (imposto por ESLint), e criar o usuário de autenticação
 * exige a Admin API do Supabase. Uma Server Action teria que chamar a rota
 * mesmo assim.
 *
 * A resposta traz `inviteUrl` SEMPRE, mesmo quando o e-mail saiu. Sem SMTP
 * próprio configurado no projeto Supabase, o e-mail de convite pode
 * simplesmente não chegar — e sem o link na tela o cliente não consegue
 * adicionar ninguém ao canal.
 */

type Resposta = {
  ok?: true;
  error?: string;
  message?: string;
  emailSent?: boolean;
  inviteUrl?: string | null;
  memberStatus?: string;
};

export default function ConviteForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<Resposta>({});
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setEnviando(true);
    setCopiado(false);
    setState({});

    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          fullName: String(formData.get("fullName") ?? ""),
          role: String(formData.get("role") ?? ""),
        }),
      });
      const body = (await response.json()) as Resposta;
      setState(body);
      if (response.ok && body.ok) {
        form.reset();
        // A lista de equipe é renderizada no servidor: sem isto, o convidado
        // recém-criado só apareceria no próximo recarregamento manual.
        startTransition(() => router.refresh());
      }
    } catch {
      setState({ error: "Não foi possível falar com o servidor. Tente de novo." });
    } finally {
      setEnviando(false);
    }
  }

  const ocupado = enviando || pending;

  return (
    <>
      <form onSubmit={onSubmit}>
        <div className="field-grid two">
          <label>
            E-mail corporativo
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              placeholder="pessoa@empresa.com.br"
              autoComplete="off"
            />
          </label>
          <label>
            Nome completo
            <input name="fullName" required maxLength={120} placeholder="Nome e sobrenome" />
          </label>
          <label>
            Papel no canal
            <select name="role" defaultValue="triagem">
              {ROLE_ORDER.map(role => (
                <option key={role} value={role}>
                  {roleLabel(role)} — {ROLE_DESCRIPTION[role]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="case-actions">
          <button className="primary-button" type="submit" disabled={ocupado}>
            {ocupado ? "Convidando…" : "Enviar convite"} <span>→</span>
          </button>
        </div>
      </form>

      {state.error ? <span className="field-error-message">{state.error}</span> : null}

      {state.ok ? (
        <>
          <div className="care-note">
            <span>✓</span>
            <div>
              <strong>
                {state.emailSent
                  ? "Convite enviado por e-mail"
                  : "Convite criado — o e-mail NÃO foi enviado"}
              </strong>
              <small>{state.message}</small>
            </div>
          </div>

          {state.inviteUrl ? (
            <div className="privacy-note">
              <b>Link de convite — copie e mande você mesmo</b>
              <p>
                Este link define a senha e libera o acesso da pessoa. Ele vale por tempo limitado e
                serve uma vez. Mande por um canal que você confie; quem tiver o link entra no painel
                com o papel escolhido acima.
              </p>
              <label className="wide-field">
                Link
                <textarea readOnly rows={3} value={state.inviteUrl} aria-label="Link de convite" />
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
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
