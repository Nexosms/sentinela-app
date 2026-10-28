"use client";

import { useId, useState } from "react";

import { ArrowRight, Chat, Lock, ShieldCheck } from "@/components/public/icons";
import type { TrackedMessage } from "@/lib/report/tracking";

import { formatWhen, sendMessage, TrackRequestError } from "./trackingClient";

/** Cabeçalho de cada balão. "VOCÊ" só para o próprio denunciante. */
function authorLabel(message: TrackedMessage): string {
  if (message.authorType === "reporter") return "VOCÊ";
  if (message.authorType === "system") return "SISTEMA";
  return "EQUIPE DO CANAL";
}

/**
 * Caixa postal. O envio é um POST e a lista é recarregada do servidor: o que aparece é o que foi
 * gravado, nunca o que o navegador achou que enviou.
 */
export default function Mailbox({
  messages,
  canReply,
  onSent,
  onSessionLost,
}: {
  messages: TrackedMessage[];
  canReply: boolean;
  onSent: () => Promise<void>;
  onSessionLost: (message: string) => void;
}) {
  const draftId = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      await sendMessage(body);
      // A mensagem exibida é a que o servidor gravou, não a que digitamos.
      setDraft("");
      await onSent();
    } catch (failure) {
      const message =
        failure instanceof Error
          ? failure.message
          : "Não foi possível enviar a mensagem agora. Tente de novo.";
      if (failure instanceof TrackRequestError && failure.status === 401) {
        onSessionLost(message);
        return;
      }
      setError(message);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="wz-card wc-block">
      <div className="wc-head">
        <span className="wc-ic" aria-hidden="true">
          <Chat size={20} />
        </span>
        <div>
          <h2>Caixa postal protegida</h2>
          <small>Converse sem revelar sua identidade</small>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="wc-empty">
          <b>Nenhuma mensagem ainda</b>
          <p>
            Quando a equipe do canal precisar de algo, a mensagem aparece aqui. Você também pode
            escrever primeiro.
          </p>
        </div>
      ) : (
        <div className="wc-msgs">
          {messages.map(message => (
            <div
              key={message.id}
              className={`wc-msg ${message.authorType === "reporter" ? "vc" : "eq"}`}
            >
              <small>
                {authorLabel(message)} · {formatWhen(message.createdAt)}
              </small>
              <p>{message.body}</p>
            </div>
          ))}
        </div>
      )}

      {canReply ? (
        <div className="wc-compose">
          <label htmlFor={draftId} className="wz-sr">
            Escreva uma resposta ou complementação
          </label>
          <textarea
            id={draftId}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder="Escreva uma resposta ou complementação…"
            rows={4}
            disabled={sending}
          />
          <p className="wc-tip">
            <ShieldCheck size={16} />
            <span>Se quiser manter o anonimato, não inclua dados que identifiquem você.</span>
          </p>
          {error ? (
            <div className="wz-tf-error" role="alert">
              <span>{error}</span>
            </div>
          ) : null}
          <div className="wc-send">
            <button
              className="wz-continue wc-btn"
              type="button"
              onClick={() => void submit()}
              disabled={sending || !draft.trim()}
            >
              {sending ? "Enviando…" : "Enviar resposta"}
              <span className="wz-seta">
                <ArrowRight />
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="wc-closed">
          <Lock size={18} />
          <div>
            <b>Esta caixa postal foi encerrada</b>
            <p>
              O caso já foi concluído, então novas mensagens não são aceitas. O histórico acima
              continua disponível enquanto você tiver o protocolo e a chave.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
