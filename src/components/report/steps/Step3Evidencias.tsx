"use client";

import { FieldError } from "../fields";
import { useWizard, type PickedFile } from "../wizardState";

/** Texto do `<small>` de cada arquivo. O protótipo prometia "integridade
 *  verificada no envio"; aqui a promessa vira estado observável. */
function fileNote(file: PickedFile): string {
  const size = `${(file.file.size / 1024 / 1024).toFixed(2)} MB`;
  switch (file.status) {
    case "hashing":
      return `${size} · calculando hash de integridade… ${file.progress}%`;
    case "uploading":
      return `${size} · enviando… ${file.progress}%`;
    case "done":
      return `${size} · enviado · integridade verificada (SHA-256 ${file.sha256?.slice(0, 12)}…)`;
    case "error":
      return `${size} · ${file.error ?? "falha no envio"}`;
    default:
      return `${size} · integridade verificada no envio`;
  }
}

export default function Step3Evidencias() {
  const { state, addFiles, removeFile } = useWizard();

  return (
    <>
      <span className="section-kicker">EVIDÊNCIAS</span>
      <h1>Você tem algum arquivo?</h1>
      <p className="lead">
        É opcional. O relato pode ser enviado sem anexos e complementado depois.
      </p>
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
        />
        <span>＋</span>
        <strong>Escolha ou arraste arquivos</strong>
        <small>Imagem, PDF, documento, áudio ou vídeo · até 15 MB por arquivo</small>
      </label>
      <FieldError
        message={
          state.rejectedFiles.length
            ? `Não foi possível anexar: ${state.rejectedFiles.join("; ")}. Nada foi enviado desses arquivos — confira antes de continuar.`
            : state.errors.evidence
        }
      />
      <div className="file-list">
        {state.files.map(file => (
          <div key={file.clientId}>
            <span>▧</span>
            <b>
              {file.file.name}
              <small>{fileNote(file)}</small>
            </b>
            <button
              type="button"
              onClick={() => removeFile(file.clientId)}
              aria-label={`Remover ${file.file.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="privacy-note">
        <b>Antes de anexar</b>
        <p>
          Não envie arquivos obtidos ilegalmente. Metadados técnicos serão tratados quando possível e
          o original receberá um hash de integridade.
        </p>
      </div>
    </>
  );
}
