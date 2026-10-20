import type { ReactNode } from "react";

import { formatDateOnly, isPastDue, todayInSaoPaulo } from "@/lib/admin/labels";
import {
  canPreview,
  fileHref,
  fileIcon,
  fileTypeLabel,
  formatSize,
  previewKind,
} from "@/lib/portal/files";
import { actionStatusClass, actionStatusLabel } from "@/lib/portal/portal";

/**
 * Peças de leitura do Portal do Cliente, usadas pela visão do cliente
 * (`/admin/reunioes`, `/admin/materiais`) e pela gestão da Nexo. Nenhuma
 * decide acesso: quem enxerga o quê é a RLS, e a rota `/api/portal/files/<id>`
 * confere de novo antes de assinar qualquer URL.
 */

export type PortalFileRow = {
  id: string;
  title: string;
  description: string | null;
  mime_type: string;
  size_bytes: number;
  published_at: string;
  filename: string;
};

/** Cartão de arquivo: ícone, título, descrição, metadados e Visualizar/Baixar. `children` = ações extras da gestão. */
export function FileCard({ file, children }: { file: PortalFileRow; children?: ReactNode }) {
  const preview = canPreview(file.mime_type);
  return (
    <article className="portal-file">
      <span className="portal-file-icon" aria-hidden="true">
        {fileIcon(file.mime_type)}
      </span>
      <div className="portal-file-body">
        <strong>{file.title}</strong>
        {file.description ? <p>{file.description}</p> : null}
        <small>
          {fileTypeLabel(file.mime_type)} · {formatSize(file.size_bytes)} · publicado em{" "}
          {formatDateOnly(file.published_at)}
        </small>
      </div>
      <div className="portal-file-actions">
        {preview ? (
          <a href={fileHref(file.id, { inline: true })} target="_blank" rel="noopener noreferrer">
            Visualizar
          </a>
        ) : null}
        <a href={fileHref(file.id)} download={file.filename}>
          Baixar
        </a>
      </div>
      {children ? <div className="portal-file-extra">{children}</div> : null}
    </article>
  );
}

/** Reprodução direta na plataforma, quando o formato é compatível; senão só baixar. */
export function Recording({ file, children }: { file: PortalFileRow; children?: ReactNode }) {
  const kind = previewKind(file.mime_type);
  const src = fileHref(file.id, { inline: true });
  return (
    <article className="portal-recording">
      <div className="portal-recording-head">
        <div>
          <strong>{file.title}</strong>
          {file.description ? <p>{file.description}</p> : null}
          <small>
            {fileTypeLabel(file.mime_type)} · {formatSize(file.size_bytes)} · publicado em{" "}
            {formatDateOnly(file.published_at)}
          </small>
        </div>
        <a className="portal-download" href={fileHref(file.id)} download={file.filename}>
          ⤓ Baixar
        </a>
      </div>
      {kind === "video" ? (
        <video className="portal-player" controls preload="metadata" playsInline src={src}>
          Seu navegador não reproduz este vídeo. Use o botão Baixar.
        </video>
      ) : kind === "audio" ? (
        <audio className="portal-audio" controls preload="metadata" src={src}>
          Seu navegador não reproduz este áudio. Use o botão Baixar.
        </audio>
      ) : (
        <p className="portal-note">Este formato não toca no navegador. Use o botão Baixar.</p>
      )}
      {kind === "video" && file.mime_type === "video/quicktime" ? (
        <p className="portal-note">
          Arquivos .mov nem sempre tocam no navegador. Se não abrir, baixe o arquivo.
        </p>
      ) : null}
      {children ? <div className="portal-file-extra">{children}</div> : null}
    </article>
  );
}

export type ActionRow = {
  id: string;
  description: string;
  owner_name: string | null;
  due_on: string | null;
  status: string;
};

/** Prazo vencido só pesa em ação ainda aberta. */
export function ActionItem({ item, children }: { item: ActionRow; children?: ReactNode }) {
  const overdue = item.status !== "concluido" && isPastDue(item.due_on, todayInSaoPaulo());
  return (
    <article className="portal-action">
      <div className="portal-action-main">
        <strong>{item.description}</strong>
        <small>
          {item.owner_name ? `Responsável: ${item.owner_name}` : "Sem responsável definido"} ·{" "}
          <span className={overdue ? "danger" : undefined}>
            {item.due_on ? `prazo ${formatDateOnly(item.due_on)}${overdue ? " · atrasado" : ""}` : "sem prazo"}
          </span>
        </small>
      </div>
      <span className={actionStatusClass(item.status)}>{actionStatusLabel(item.status)}</span>
      {children ? <div className="portal-file-extra">{children}</div> : null}
    </article>
  );
}

export function EmptyNote({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="care-note">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}
