"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import Brand from "@/components/brand/Brand";
import type { TrackedCase } from "@/lib/report/tracking";

import CaseHeader from "./CaseHeader";
import EvidenceList from "./EvidenceList";
import Mailbox from "./Mailbox";
import SafeTimeline from "./SafeTimeline";
import TrackForm, { type Credentials } from "./TrackForm";
import { formatWhen, openCase, refreshCase, TrackRequestError } from "./trackingClient";

/**
 * Único nó com estado do acompanhamento (_legacy, l. 150).
 *
 * Duas views na MESMA URL: consulta e caixa postal. A transição é de estado,
 * nunca de rota — o protocolo não pode aparecer em `/acompanhar/XXXX`, onde
 * viajaria no histórico do navegador, no `Referer` e nos logs de acesso.
 *
 * As credenciais ficam só em memória (nada de localStorage: um F5 exige
 * digitar de novo, e é assim que deve ser num computador compartilhado). O
 * acesso subsequente usa o cookie HttpOnly emitido pelo POST /track.
 */
export default function TrackingScreen() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credentials>({ protocol: "", secret: "" });
  const [trackedCase, setTrackedCase] = useState<TrackedCase | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isTracked = trackedCase !== null;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [isTracked]);

  /** Volta ao formulário sem manter a chave digitada. */
  const dropSession = useCallback((message: string) => {
    setTrackedCase(null);
    setCredentials(current => ({ protocol: current.protocol, secret: "" }));
    setError(message);
  }, []);

  /**
   * Recarrega o caso do servidor. É o que roda depois de mandar uma mensagem
   * ou anexar um arquivo: a tela mostra o que foi gravado, não o que o
   * navegador achou que tinha acontecido.
   */
  const refresh = useCallback(async () => {
    try {
      setTrackedCase(await refreshCase());
    } catch (failure) {
      if (failure instanceof TrackRequestError && failure.status === 401) {
        dropSession(failure.message);
        return;
      }
      throw failure;
    }
  }, [dropSession]);

  async function handleTrack(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");

    // Sem curto-circuito: mesmo vindo do comprovante, quem decide se o
    // protocolo e a chave conferem é o servidor.
    if (!credentials.protocol.trim() || !credentials.secret.trim()) {
      setError("Informe o protocolo e a chave de acompanhamento.");
      return;
    }

    setLoading(true);
    try {
      setTrackedCase(await openCase(credentials.protocol.trim(), credentials.secret));
      // A chave sai da memória assim que a sessão existe.
      setCredentials(current => ({ ...current, secret: "" }));
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível consultar agora. Tente novamente em alguns minutos.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="tracking-shell">
      <header className="wizard-header">
        <Brand />
        <button type="button" className="quiet-link" onClick={() => router.push("/")}>
          Voltar ao canal
        </button>
      </header>
      {!trackedCase ? (
        <TrackForm
          credentials={credentials}
          setCredentials={setCredentials}
          error={error}
          loading={loading}
          onSubmit={handleTrack}
        />
      ) : (
        <section className="mailbox">
          <CaseHeader trackedCase={trackedCase} />
          <SafeTimeline steps={trackedCase.timeline} />
          {trackedCase.closureSummary && (
            <div className="care-note">
              <span>✓</span>
              <div>
                <strong>Desfecho comunicado</strong>
                <small>{trackedCase.closureSummary}</small>
              </div>
            </div>
          )}
          <Mailbox
            messages={trackedCase.messages}
            canReply={trackedCase.canReply}
            onSent={refresh}
            onSessionLost={dropSession}
          />
          <EvidenceList
            evidence={trackedCase.evidence}
            canReply={trackedCase.canReply}
            onUploaded={refresh}
          />
          <div className="care-note">
            <span>◔</span>
            <div>
              <strong>Última atualização: {formatWhen(trackedCase.updatedAt)}</strong>
              <small>
                Relato recebido em {formatWhen(trackedCase.receivedAt)}. Esta consulta expira
                sozinha; ao voltar, o protocolo e a chave serão pedidos de novo.
              </small>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
