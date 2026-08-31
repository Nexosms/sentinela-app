"use client";

import { useState } from "react";

import { complementEvidence, validatePickedFiles } from "@/components/report/UploadClient";
import type { TrackedEvidence } from "@/lib/report/tracking";

import { formatWhen } from "./trackingClient";

type PickedFile = { clientId: string; file: File; progress: number };

/** Arquivos pequenos em KB: "0,00 MB" não diz nada a quem anexou um .txt. */
function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Evidências do caso e complemento pós-envio.
 *
 * O protótipo não tinha nada disso: o relato era enviado e a pessoa nunca mais
 * via o que havia anexado, nem podia anexar o documento que só apareceu
 * depois. A verificação de integridade também deixa de ser promessa — enquanto
 * o servidor não confirma o SHA-256 do objeto, o arquivo aparece como "em
 * verificação".
 */
export default function EvidenceList({
  evidence,
  canReply,
  onUploaded,
}: {
  evidence: TrackedEvidence[];
  canReply: boolean;
  onUploaded: () => Promise<void>;
}) {
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  function addFiles(fileList: FileList | null) {
    const incoming = Array.from(fileList ?? []);
    if (!incoming.length) return;
    const result = validatePickedFiles(incoming, picked.length);
    setRejected(result.rejected.map(item => `${item.name} (${item.reason})`));
    setPicked(current => [
      ...current,
      ...result.accepted.map(file => ({ clientId: crypto.randomUUID(), file, progress: 0 })),
    ]);
  }

  async function upload() {
    if (!picked.length || sending) return;
    setSending(true);
    setError("");
    try {
      await complementEvidence(
        picked.map(item => ({ clientId: item.clientId, file: item.file })),
        (clientId, progress) => {
          setPicked(current =>
            current.map(item => (item.clientId === clientId ? { ...item, progress } : item)),
          );
        },
      );
      setPicked([]);
      await onUploaded();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Não foi possível anexar os arquivos ao caso. Nada foi adicionado.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <span className="section-kicker">EVIDÊNCIAS DO CASO</span>
      <div className="file-list">
        {evidence.map(item => (
          <div key={item.id}>
            <span>▧</span>
            <b>
              {item.filename}
              <small>
                {sizeLabel(item.sizeBytes)} · {formatWhen(item.createdAt)} ·{" "}
                {item.verified ? "integridade verificada" : "integridade em verificação"}
              </small>
            </b>
          </div>
        ))}
        {picked.map(item => (
          <div key={item.clientId}>
            <span>▧</span>
            <b>
              {item.file.name}
              <small>
                {sizeLabel(item.file.size)} ·{" "}
                {sending ? `enviando… ${item.progress}%` : "ainda não enviado"}
              </small>
            </b>
            <button
              type="button"
              onClick={() => setPicked(current => current.filter(f => f.clientId !== item.clientId))}
              aria-label={`Remover ${item.file.name}`}
              disabled={sending}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {evidence.length === 0 && picked.length === 0 && (
        <div className="care-note">
          <span>▧</span>
          <div>
            <strong>Nenhum arquivo anexado</strong>
            <small>
              {canReply
                ? "Se algum documento, imagem ou áudio ajudar a entender o caso, anexe abaixo."
                : "O relato foi enviado sem anexos."}
            </small>
          </div>
        </div>
      )}
      {canReply && (
        <>
          <label className="dropzone">
            <input
              type="file"
              multiple
              onChange={event => {
                addFiles(event.target.files);
                // Permite reescolher o mesmo arquivo depois de removê-lo.
                event.target.value = "";
              }}
              accept="image/*,.pdf,.doc,.docx,audio/*,video/*,.txt"
              disabled={sending}
            />
            <span>＋</span>
            <strong>Anexar mais evidências</strong>
            <small>Imagem, PDF, documento, áudio ou vídeo · até 15 MB por arquivo</small>
          </label>
          {(error || rejected.length > 0) && (
            <div className="form-error" role="alert">
              {error ||
                `Não foi possível anexar: ${rejected.join("; ")}. Nada foi enviado desses arquivos.`}
            </div>
          )}
          {picked.length > 0 && (
            <button
              className="primary-button"
              type="button"
              onClick={() => void upload()}
              disabled={sending}
            >
              {sending ? "Enviando anexos…" : "Enviar anexos"} <span>→</span>
            </button>
          )}
        </>
      )}
    </>
  );
}
