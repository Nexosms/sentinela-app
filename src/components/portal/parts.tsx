import type { ReactNode } from "react";

import {
  IconAudio,
  IconDoc,
  IconDownload,
  IconEye,
  IconEyeOff,
  IconImage,
  IconPresentation,
  IconSheet,
  IconVideo,
} from "@/components/admin/shell/AdminIcons";
import { formatDateOnly, isPastDue, todayInSaoPaulo } from "@/lib/admin/labels";
import {
  canPreview,
  fileHref,
  fileTypeLabel,
  fileVisual,
  formatSize,
  previewKind,
  type FileVisual,
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

/** Publicado há menos de 14 dias: ganha o selo "Novo". Só informativo. */
const DIAS_NOVO = 14;
function recente(publishedAt: string): boolean {
  const idade = Date.now() - new Date(publishedAt).getTime();
  return idade >= 0 && idade < DIAS_NOVO * 86_400_000;
}

function FileIcon({ icon, size = 26 }: { icon: FileVisual["icon"]; size?: number }) {
  switch (icon) {
    case "pdf":
    case "doc":
    case "generic":
      return <IconDoc size={size} />;
    case "presentation":
      return <IconPresentation size={size} />;
    case "sheet":
      return <IconSheet size={size} />;
    case "video":
      return <IconVideo size={size} />;
    case "audio":
      return <IconAudio size={size} />;
    case "image":
      return <IconImage size={size} />;
  }
}

/** Cartão de arquivo: quadro colorido por tipo, título, descrição, metadados e Visualizar/Baixar. `children` = ações extras da gestão. */
export function FileCard({ file, children }: { file: PortalFileRow; children?: ReactNode }) {
  const preview = canPreview(file.mime_type);
  const visual = fileVisual(file.mime_type);
  return (
    <article className="mt-arq">
      <span className={`mt-tile ${visual.cls}`} aria-hidden="true">
        <FileIcon icon={visual.icon} />
        <em>{fileTypeLabel(file.mime_type)}</em>
      </span>
      <div className="mt-arq-c">
        <div className="mt-arq-t">
          <strong>{file.title}</strong>
          {recente(file.published_at) ? <i className="mt-tag">Novo</i> : null}
        </div>
        {file.description ? <p>{file.description}</p> : null}
        <small>
          {formatSize(file.size_bytes)} · publicado em {formatDateOnly(file.published_at)}
        </small>
      </div>
      <div className="mt-arq-a">
        {preview ? (
          <a className="mt-bt" href={fileHref(file.id, { inline: true })} target="_blank" rel="noopener noreferrer">
            <IconEye />
            Visualizar
          </a>
        ) : null}
        <a className="mt-bt mt-pr" href={fileHref(file.id)} download={file.filename}>
          <IconDownload />
          Baixar
        </a>
      </div>
      {children ? <div className="mt-arq-extra">{children}</div> : null}
    </article>
  );
}

/**
 * Linha de arquivo da GESTÃO (Nexo): tipo, título, categoria, situação (visível ou rascunho) e "Ver".
 * `children` traz o editor (editar, substituir ou excluir), que continua sendo o mesmo de antes.
 */
export function ManageRow({
  file,
  categoria,
  visible,
  children,
}: {
  file: PortalFileRow;
  categoria?: string;
  visible: boolean;
  children?: ReactNode;
}) {
  const visual = fileVisual(file.mime_type);
  const inline = canPreview(file.mime_type);
  return (
    <article className="mt-ln">
      <span className={`mt-tile mt-peq ${visual.cls}`} aria-hidden="true">
        <FileIcon icon={visual.icon} size={22} />
      </span>
      <div className="mt-ln-c">
        <strong>{file.title}</strong>
        <small>
          {fileTypeLabel(file.mime_type)} · {formatSize(file.size_bytes)}
          {categoria ? ` · ${categoria}` : ""}
        </small>
      </div>
      <span className={`mt-est ${visible ? "ok" : "rasc"}`}>
        {visible ? <IconEye size={15} /> : <IconEyeOff />}
        {visible ? "Visível" : "Rascunho"}
      </span>
      <a
        className="mt-bt mt-ver"
        href={fileHref(file.id, inline ? { inline: true } : {})}
        {...(inline ? { target: "_blank", rel: "noopener noreferrer" } : { download: file.filename })}
      >
        <IconEye />
        Ver
      </a>
      {children ? <div className="mt-ln-extra">{children}</div> : null}
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
