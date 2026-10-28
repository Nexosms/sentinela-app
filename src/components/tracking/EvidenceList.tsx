"use client";

import { useState } from "react";

import {
  Alert,
  ArrowRight,
  AudioFile,
  Check,
  DocFile,
  ImageFile,
  Paperclip,
  Trash,
  UploadCloud,
} from "@/components/public/icons";
import { complementEvidence, validatePickedFiles } from "@/components/report/UploadClient";
import type { TrackedEvidence } from "@/lib/report/tracking";

import { formatWhen } from "./trackingClient";

type PickedFile = { clientId: string; file: File; progress: number };

/** Arquivos pequenos em KB: "0,00 MB" não diz nada a quem anexou um .txt. */
function sizeLabel(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

/** Ícone e cor pela extensão: o servidor devolve só o nome do arquivo, não o tipo. */
function kind(name: string): { Icon: typeof ImageFile; tint: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic", "bmp"].includes(ext)) {
    return { Icon: ImageFile, tint: "wz-t-red" };
  }
  if (["mp3", "m4a", "wav", "ogg", "aac", "mp4", "mov", "webm", "mkv"].includes(ext)) {
    return { Icon: AudioFile, tint: "wz-t-amber" };
  }
  return { Icon: DocFile, tint: "wz-t-red" };
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

  const total = evidence.length;
  const rejectedText = rejected.length
    ? `Não foi possível anexar: ${rejected.join("; ")}. Nada foi enviado desses arquivos.`
    : "";

  return (
    <section className="wz-card wc-block">
      <div className="wc-head">
        <span className="wc-ic" aria-hidden="true">
          <Paperclip size={20} />
        </span>
        <div>
          <h2>
            Evidências do caso{total > 0 ? <em>{total}</em> : null}
          </h2>
          <small>Cada arquivo tem a integridade verificada pelo servidor</small>
        </div>
      </div>

      {total > 0 || picked.length > 0 ? (
        <ul className="wz-files wc-files" aria-label="Arquivos do caso">
          {evidence.map(item => {
            const { Icon, tint } = kind(item.filename);
            return (
              <li key={item.id} className={`wz-file ${item.verified ? "done" : ""}`}>
                <span className={`wz-file-icon ${tint}`} aria-hidden="true">
                  <Icon size={22} />
                </span>
                <div className="wz-file-info">
                  <b>{item.filename}</b>
                  <small>
                    {sizeLabel(item.sizeBytes)} · {formatWhen(item.createdAt)} ·{" "}
                    {item.verified ? "integridade verificada" : "integridade em verificação"}
                  </small>
                </div>
                {item.verified ? (
                  <span className="wz-file-status ok">
                    <Check size={14} /> Verificado
                  </span>
                ) : (
                  <span className="wz-file-status">Em verificação</span>
                )}
              </li>
            );
          })}
          {picked.map(item => {
            const { Icon, tint } = kind(item.file.name);
            return (
              <li key={item.clientId} className="wz-file">
                <span className={`wz-file-icon ${tint}`} aria-hidden="true">
                  <Icon size={22} />
                </span>
                <div className="wz-file-info">
                  <b>{item.file.name}</b>
                  <small>
                    {sizeLabel(item.file.size)} ·{" "}
                    {sending ? `enviando… ${item.progress}%` : "ainda não enviado"}
                  </small>
                  {sending ? (
                    <span
                      className="wz-bar"
                      role="progressbar"
                      aria-label={`Envio de ${item.file.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={item.progress}
                    >
                      <i style={{ width: `${item.progress}%` }} />
                    </span>
                  ) : null}
                </div>
                <span className="wz-file-status">{sending ? `${item.progress}%` : "Pronto"}</span>
                <button
                  type="button"
                  className="wz-file-remove"
                  onClick={() =>
                    setPicked(current => current.filter(f => f.clientId !== item.clientId))
                  }
                  aria-label={`Remover ${item.file.name}`}
                  disabled={sending}
                >
                  <Trash size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="wc-empty">
          <b>Nenhum arquivo anexado</b>
          <p>
            {canReply
              ? "Se algum documento, imagem ou áudio ajudar a entender o caso, anexe abaixo."
              : "O relato foi enviado sem anexos."}
          </p>
        </div>
      )}

      {canReply && (
        <>
          <label className="wz-drop wc-drop">
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
            <span className="wz-drop-icon" aria-hidden="true">
              <UploadCloud size={26} />
            </span>
            <strong>Anexar mais evidências</strong>
            <span className="wz-drop-sub">
              Imagem, PDF, documento, áudio ou vídeo · até 15 MB por arquivo
            </span>
          </label>
          {(error || rejectedText) && (
            <div className="wz-rejected" role="alert">
              <Alert size={18} />
              <span>{error || rejectedText}</span>
            </div>
          )}
          {picked.length > 0 && (
            <div className="wc-send">
              <button
                className="wz-continue wc-btn"
                type="button"
                onClick={() => void upload()}
                disabled={sending}
              >
                {sending ? "Enviando anexos…" : "Enviar anexos"}
                <span className="wz-seta">
                  <ArrowRight />
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
