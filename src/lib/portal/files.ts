/**
 * Regras de arquivo do Portal do Cliente. Sem `server-only`: o navegador usa
 * `resolveMime` para saber que contentType mandar no upload, e a UI usa
 * `previewKind` para decidir entre player, imagem ou só download.
 */

export const PORTAL_BUCKET = "portal";

/** Mesmo teto do bucket (migração 040). O limite GLOBAL do projeto, no painel do Supabase, manda por cima. */
export const PORTAL_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/** MIME aceito → extensão gravada no objeto. A extensão vem do MIME, nunca do nome enviado. */
export const PORTAL_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "text/csv": "csv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "weba",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

/** O navegador às vezes manda `file.type` vazio (ex.: .csv no Windows); a extensão do nome decide então. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  weba: "audio/webm",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

export const PORTAL_ACCEPT = Object.keys(MIME_BY_EXT)
  .map(ext => `.${ext}`)
  .join(",");

export const PORTAL_MEDIA_ACCEPT = ".mp4,.webm,.mov,.mp3,.m4a,.ogg,.wav,.weba";

/** MIME final de um arquivo: o declarado, se for aceito; senão o da extensão; senão `null`. */
export function resolveMime(filename: string, declared: string | null | undefined): string | null {
  const type = (declared ?? "").toLowerCase().split(";")[0].trim();
  if (type && PORTAL_MIME[type]) return type;
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}

export function isAllowedMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(PORTAL_MIME, mime);
}

export function extForMime(mime: string): string {
  return PORTAL_MIME[mime] ?? "bin";
}

export type PreviewKind = "video" | "audio" | "image" | "pdf" | "other";

/**
 * Só estes tipos podem ser abertos "no site" (URL assinada SEM `Content-Disposition:
 * attachment`). Tudo que o navegador poderia executar (HTML, SVG) nem entra na
 * lista de aceitos, e o resto — Word, Excel, PowerPoint — sempre baixa.
 */
export function previewKind(mime: string): PreviewKind {
  if (mime === "video/mp4" || mime === "video/webm" || mime === "video/quicktime") return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp" || mime === "image/gif")
    return "image";
  if (mime === "application/pdf") return "pdf";
  return "other";
}

export function canPreview(mime: string): boolean {
  return previewKind(mime) !== "other";
}

export function isMediaMime(mime: string): boolean {
  const kind = previewKind(mime);
  return kind === "video" || kind === "audio";
}

/** Rótulo curto do tipo, para o selo do cartão. */
export function fileTypeLabel(mime: string): string {
  const ext = PORTAL_MIME[mime];
  return ext ? ext.toUpperCase() : "ARQUIVO";
}

export function fileIcon(mime: string): string {
  switch (previewKind(mime)) {
    case "video":
      return "▶";
    case "audio":
      return "♪";
    case "image":
      return "▨";
    case "pdf":
      return "▤";
    default:
      return "▧";
  }
}

/** Como `formatBytes` de labels.ts, mas chega a GB — uma gravação passa de 1 GB com facilidade. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Rota de abertura/baixa (ver `src/app/api/portal/files/[id]/route.ts`). */
export function fileHref(id: string, options: { inline?: boolean } = {}): string {
  return `/api/portal/files/${id}${options.inline ? "?inline=1" : ""}`;
}
