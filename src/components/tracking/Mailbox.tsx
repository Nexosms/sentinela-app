"use client";

import { useState } from "react";

import type { TrackedMessage } from "@/lib/report/tracking";

import { formatWhen, sendMessage, TrackRequestError } from "./trackingClient";

/** Cabeçalho de cada balão. "VOCÊ" só para o próprio denunciante. */
function authorLabel(message: TrackedMessage): string {
  if (message.authorType === "reporter") return "VOCÊ";
  if (message.authorType === "system") return "SISTEMA";
  return "EQUIPE DO CANAL";
}

/**
 * Caixa postal (_legacy, l. 151).
 *
 * Três mentiras do protótipo morrem aqui: a mensagem da empresa era um
 * parágrafo escrito no código, a caixa nunca ficava vazia (mostrava sempre a
 * mensagem falsa), e o botão "Enviar resposta" só fazia `setSent(true)` — a
 * pessoa podia acreditar que tinha respondido ao canal e ser ignorada. Agora o
 * envio é um POST e a lista é recarregada do servidor.
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
    <div className="message-box">
      <div className="message-head">
        <span>□</span>
        <div>
          <strong>Caixa postal protegida</strong>
          <small>Converse sem revelar sua identidade</small>
        </div>
      </div>
      {messages.length === 0 ? (
        <div className="care-note">
          <span>✉</span>
          <div>
            <strong>Nenhuma mensagem ainda</strong>
            <small>
              Quando a equipe do canal precisar de algo, a mensagem aparece aqui. Você também pode
              escrever primeiro.
            </small>
          </div>
        </div>
      ) : (
        messages.map(message => (
          <div
            key={message.id}
            className={message.authorType === "reporter" ? "user-message" : "company-message"}
          >
            <small>
              {authorLabel(message)} · {formatWhen(message.createdAt)}
            </small>
            <p>{message.body}</p>
          </div>
        ))
      )}
      {canReply ? (
        <>
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder="Escreva uma resposta ou complementação…"
            rows={4}
            disabled={sending}
            aria-label="Escreva uma resposta ou complementação"
          />
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="primary-button"
            type="button"
            onClick={() => void submit()}
            disabled={sending || !draft.trim()}
          >
            {sending ? "Enviando…" : "Enviar resposta"} <span>→</span>
          </button>
        </>
      ) : (
        <div className="care-note">
          <span>✓</span>
          <div>
            <strong>Esta caixa postal foi encerrada</strong>
            <small>
              O caso já foi concluído, então novas mensagens não são aceitas. O histórico acima
              continua disponível enquanto você tiver o protocolo e a chave.
            </small>
          </div>
        </div>
      )}
    </div>
  );
}
