"use client";

import { useState } from "react";

import {
  Alert,
  AudioFile,
  Check,
  DocFile,
  ImageFile,
  ShieldCheck,
  Trash,
  UploadCloud,
} from "@/components/public/icons";

import { useWizard, type PickedFile } from "../wizardState";

const TIPOS = ["Imagem", "PDF", "Documento", "Áudio", "Vídeo"];

function sizeLabel(file: File): string {
  const mb = file.size / 1024 / 1024;
  return `${mb.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
}

/** Ícone e cor pelo tipo do arquivo. */
function kind(file: File): { Icon: typeof ImageFile; tint: string } {
  if (file.type.startsWith("image/")) return { Icon: ImageFile, tint: "wz-t-red" };
  if (file.type.startsWith("audio/") || file.type.startsWith("video/")) {
    return { Icon: AudioFile, tint: "wz-t-amber" };
  }
  return { Icon: DocFile, tint: "wz-t-red" };
}

/** Linha de estado de cada arquivo — a promessa de "integridade verificada" vira estado observável. */
function fileNote(file: PickedFile) {
  const size = sizeLabel(file.file);
  switch (file.status) {
    case "hashing":
      return <>{size} · calculando hash de integridade… {file.progress}%</>;
    case "uploading":
      return <>{size} · enviando… {file.progress}%</>;
    case "done":
      return (
        <>
          {size} · enviado · integridade verificada{" "}
          {file.sha256 ? <code>SHA-256 {file.sha256.slice(0, 12)}…</code> : null}
        </>
      );
    case "error":
      return <>{size} · {file.error ?? "falha no envio"}</>;
    default:
      return <>{size} · integridade verificada no envio</>;
  }
}

function statusLabel(file: PickedFile): string {
  switch (file.status) {
    case "hashing":
    case "uploading":
      return `${file.progress}%`;
    case "error":
      return "Erro";
    default:
      return "Pronto";
  }
}

export default function Step3Evidencias() {
  const { state, addFiles, removeFile } = useWizard();
  const [over, setOver] = useState(false);

  const rejected = state.rejectedFiles.length
    ? `Não foi possível anexar: ${state.rejectedFiles.join("; ")}. Nada foi enviado desses arquivos — confira antes de continuar.`
    : state.errors.evidence;

  return (
    <>
      <span className="wz-kicker">EVIDÊNCIAS</span>
      <h1>Você tem algum arquivo?</h1>
      <p className="wz-lead">É opcional. O relato pode ser enviado sem anexos e complementado depois.</p>

      <label
        className={`wz-drop ${over ? "over" : ""}`}
        onDragEnter={() => setOver(true)}
        onDragOver={() => setOver(true)}
        onDragLeave={() => setOver(false)}
        onDrop={() => setOver(false)}
      >
        <input
          type="file"
          multiple
          onChange={event => {
            addFiles(event.target.files);
            // Permite reescolher o mesmo arquivo depois de removê-lo.
            event.target.value = "";
          }}
          accept="image/*,.pdf,.doc,.docx,audio/*,video/*,.txt"
        />
        <span className="wz-drop-icon" aria-hidden="true">
          <UploadCloud size={30} />
        </span>
        <strong>Escolha ou arraste arquivos</strong>
        <span className="wz-drop-sub">
          Imagem, PDF, documento, áudio ou vídeo · até 15 MB por arquivo
        </span>
        <span className="wz-types" aria-hidden="true">
          {TIPOS.map(tipo => (
            <i key={tipo}>{tipo}</i>
          ))}
        </span>
      </label>

      {rejected ? (
        <div className="wz-rejected" role="alert">
          <Alert size={18} />
          <span>{rejected}</span>
        </div>
      ) : null}

      {state.files.length > 0 ? (
        <ul className="wz-files" aria-label="Arquivos anexados">
          {state.files.map(file => {
            const { Icon, tint } = kind(file.file);
            const busy = file.status === "hashing" || file.status === "uploading";
            return (
              <li key={file.clientId} className={`wz-file ${file.status}`}>
                <span className={`wz-file-icon ${tint}`} aria-hidden="true">
                  <Icon size={22} />
                </span>
                <div className="wz-file-info">
                  <b>{file.file.name}</b>
                  <small>{fileNote(file)}</small>
                  {busy ? (
                    <span
                      className="wz-bar"
                      role="progressbar"
                      aria-label={`Envio de ${file.file.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={file.progress}
                    >
                      <i style={{ width: `${file.progress}%` }} />
                    </span>
                  ) : null}
                </div>
                {file.status === "done" ? (
                  <span className="wz-file-status ok">
                    <Check size={14} /> Enviado
                  </span>
                ) : (
                  <span className="wz-file-status">{statusLabel(file)}</span>
                )}
                <button
                  type="button"
                  className="wz-file-remove"
                  onClick={() => removeFile(file.clientId)}
                  aria-label={`Remover ${file.file.name}`}
                >
                  <Trash size={18} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="wz-before">
        <ShieldCheck size={20} />
        <div>
          <b>Antes de anexar</b>
          <p>
            Não envie arquivos obtidos ilegalmente. Metadados técnicos serão tratados quando possível e
            o original receberá um hash de integridade.
          </p>
        </div>
      </div>
    </>
  );
}
