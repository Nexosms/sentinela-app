"use client";

import { useId, useState, type FormEvent } from "react";

import {
  Alert,
  ArrowRight,
  Clock,
  DocFile,
  Eye,
  EyeOff,
  Key,
  Lock,
  Mail,
} from "@/components/public/icons";

export type Credentials = { protocol: string; secret: string };

/**
 * Formulário de consulta. O `onSubmit` sempre vai à rede e o aviso de erro mostra a mensagem que
 * o servidor devolveu — 401 (dado errado), 429 (bloqueio temporário) e 503 (indisponível) chegam
 * aqui já traduzidos por `trackingClient`. As três garantias do rodapé descrevem o que a tela já
 * faz: nada do caso sai por e-mail/SMS, o cookie da consulta expira e a chave só vive em memória.
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
  const protocolId = useId();
  const secretId = useId();
  const [showSecret, setShowSecret] = useState(false);

  return (
    <section className="wz-card wz-lookup">
      <span className="wz-kicker">ACOMPANHAR RELATO</span>
      <h1>Consulte seu protocolo.</h1>
      <p className="wz-lead">Digite exatamente os dados entregues no envio, no comprovante.</p>

      <form onSubmit={onSubmit} noValidate>
        <div className="wz-tf-field">
          <label htmlFor={protocolId} className="wz-tf-label">
            <span className="wz-tf-icon" aria-hidden="true">
              <DocFile size={18} />
            </span>
            Protocolo
          </label>
          <input
            id={protocolId}
            className="wz-tf-input mono"
            value={credentials.protocol}
            onChange={event =>
              setCredentials({ ...credentials, protocol: event.target.value.toUpperCase() })
            }
            placeholder="XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="wz-tf-field">
          <label htmlFor={secretId} className="wz-tf-label">
            <span className="wz-tf-icon" aria-hidden="true">
              <Key size={18} />
            </span>
            Chave de acompanhamento
          </label>
          <div className="wz-tf-wrap">
            <input
              id={secretId}
              className="wz-tf-input mono"
              type={showSecret ? "text" : "password"}
              value={credentials.secret}
              onChange={event => setCredentials({ ...credentials, secret: event.target.value })}
              placeholder="SEN-XXXXX-XXXXX-XXXXX"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="wz-tf-eye"
              onClick={() => setShowSecret(value => !value)}
              aria-pressed={showSecret}
              aria-label={showSecret ? "Ocultar a chave" : "Mostrar a chave"}
            >
              {showSecret ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          <span className="wz-tf-help">Perdeu a chave? Por segurança, ela não pode ser recuperada.</span>
        </div>

        {error ? (
          <div key={error} className="wz-tf-error" role="alert">
            <Alert size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        <button className="wz-continue wz-tf-submit" type="submit" disabled={loading}>
          {loading ? "Consultando com segurança…" : "Consultar com segurança"}
          <span className="wz-seta">
            <ArrowRight />
          </span>
        </button>
        {/* Deixou de ser promessa: o servidor limita tentativas por dispositivo. */}
        <p className="wz-tf-limit">Por segurança, tentativas excessivas podem ser temporariamente bloqueadas.</p>
      </form>

      <ul className="wz-tf-assure">
        <li>
          <span aria-hidden="true">
            <Mail size={18} />
          </span>
          <div>
            <b>Nada por e-mail ou SMS</b>
            <small>Nenhuma informação do caso sai deste canal.</small>
          </div>
        </li>
        <li>
          <span aria-hidden="true">
            <Clock size={18} />
          </span>
          <div>
            <b>A consulta expira sozinha</b>
            <small>Ao voltar, o protocolo e a chave serão pedidos de novo.</small>
          </div>
        </li>
        <li>
          <span aria-hidden="true">
            <Lock size={18} />
          </span>
          <div>
            <b>Sua chave não fica salva</b>
            <small>Ela só existe neste dispositivo enquanto você consulta.</small>
          </div>
        </li>
      </ul>
    </section>
  );
}
