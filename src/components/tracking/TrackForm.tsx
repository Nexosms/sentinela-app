"use client";

import type { FormEvent } from "react";

export type Credentials = { protocol: string; secret: string };

/**
 * Formulário de consulta (_legacy, l. 150). Markup verbatim; o que mudou é que
 * o `onSubmit` sempre vai à rede e o `.form-error` mostra a mensagem que o
 * servidor devolveu — 401 (dado errado), 429 (bloqueio temporário) e 503
 * (indisponível) chegam aqui já traduzidos por `trackingClient`.
 */
export default function TrackForm({
  credentials,
  setCredentials,
  error,
  loading,
  onSubmit,
}: {
  credentials: Credentials;
  setCredentials: (value: Credentials) => void;
  error: string;
  loading: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <section className="track-card">
      <span className="section-kicker">ACOMPANHAR RELATO</span>
      <h1>Consulte seu protocolo.</h1>
      <p>
        Digite exatamente os dados entregues no envio. Nenhuma informação do caso é enviada por
        e-mail ou SMS.
      </p>
      <form onSubmit={onSubmit}>
        <label>
          Protocolo
          <input
            value={credentials.protocol}
            onChange={event =>
              setCredentials({ ...credentials, protocol: event.target.value.toUpperCase() })
            }
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Chave de acompanhamento
          <input
            type="password"
            value={credentials.secret}
            onChange={event => setCredentials({ ...credentials, secret: event.target.value })}
            placeholder="Sua chave privada"
            autoComplete="off"
          />
        </label>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Consultando com segurança…" : "Consultar com segurança"} <span>→</span>
        </button>
      </form>
      {/* Deixou de ser promessa: o servidor limita tentativas por dispositivo. */}
      <small>Por segurança, tentativas excessivas podem ser temporariamente bloqueadas.</small>
    </section>
  );
}
