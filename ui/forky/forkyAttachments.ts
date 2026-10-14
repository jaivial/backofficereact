// Forky F2 — file attachments for the PromptBar.
//
// Transport reality: the forky WS contract (shared v1) carries a single text
// `content` string per message frame, and the assistant model is text-only.
// So instead of inventing a multipart API, each attachment rides INSIDE the
// message content as a delimited, labeled block: text-capable files (txt, md,
// csv, json, code) contribute their extracted text (capped); binary/media
// files (images, pdf, zip…) contribute honest metadata with an explicit
// "content not extractable" note so the model never pretends it saw pixels.
// Everything below is pure and unit-tested; ForkyModal owns the React state.

export const FORKY_ATTACH_MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const FORKY_ATTACH_MAX_FILES = 6;
export const FORKY_ATTACH_MAX_TEXT_CHARS = 20_000;

/** REST endpoint (already in the backend, coord forky_media_transcribe_v1) that
 *  stores a file in the restaurant's Bunny zone and returns its coordinates. */
export const FORKY_ATTACH_UPLOAD_URL = "/api/admin/assistant/media/upload";

/** Picker accept list: images + documents. Binary docs ride as metadata only. */
export const FORKY_ATTACH_ACCEPT =
  "image/*,.pdf,.txt,.md,.markdown,.csv,.tsv,.json,.log,.xml,.yml,.yaml,.html,.js,.ts,.tsx,.jsx,.py,.go,.sql,.docx,.xlsx";

/** Statuses: textual files are read in place ("reading"); images and PDFs are
 *  uploaded to Bunny ("uploading" with 0-100 progress) so the model receives
 *  real content blocks server-side (coord forky_attachments_v1). */
export type ForkyAttachmentStatus = "reading" | "uploading" | "ready" | "error";

export type ForkyAttachment = {
  id: string;
  file: File;
  name: string;
  mime: string;
  size: number;
  status: ForkyAttachmentStatus;
  /** Upload progress 0-100 while status is "uploading" (media files only). */
  progress?: number;
  /** Extracted text (text-capable files) once status is "ready". */
  text?: string;
  /** Bunny coordinates for uploaded media, once status is "ready". */
  url?: string;
  path?: string;
  /** Honest failure reason; renders on the chip and rides to the model. */
  error?: string;
  /** Object URL for image previews (owned by the host, revoked on remove/send). */
  previewUrl?: string;
};

export type ForkyAttachmentRejection = { file: File; reason: string };

export type ForkyFileValidation = {
  accepted: File[];
  /** Files refused BEFORE becoming chips: too many, too big, wrong type. Each one
   *  is surfaced as an error chip so the refusal is visible, not silent. */
  rejected: ForkyAttachmentRejection[];
};

const TEXTUAL_EXTENSIONS = new Set([
  "txt", "md", "markdown", "csv", "tsv", "json", "log", "xml", "yml", "yaml",
  "html", "js", "ts", "tsx", "jsx", "py", "go", "sql",
]);

export function forkyAttachmentExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Files whose contents can honestly be read as text in the browser. */
export function isTextualAttachment(file: { name: string; type: string }): boolean {
  const mime = file.type.toLowerCase();
  if (mime.startsWith("text/")) return true;
  if (mime === "application/json" || mime === "image/svg+xml") return true;
  return TEXTUAL_EXTENSIONS.has(forkyAttachmentExtension(file.name));
}

/**
 * Media attachments (images, PDFs) are uploaded to Bunny and referenced in
 * the WS frame: the server re-reads the bytes and feeds the model real
 * image/document content blocks. SVG is textual (inline), not media.
 */
export function isMediaAttachment(file: { name: string; type: string }): boolean {
  if (isTextualAttachment(file)) return false;
  const mime = file.type.toLowerCase();
  if (mime === "image/svg+xml") return false;
  if (mime.startsWith("image/")) return true;
  if (mime === "application/pdf") return true;
  return forkyAttachmentExtension(file.name) === "pdf";
}

/** Wire shape of one attachment reference in the message frame (the backend
 *  validates tenant path, count, size and media type; coord
 *  forky_attachments_v1). */
export type ForkyAttachmentRef = {
  name: string;
  media_type: string;
  size: number;
  url: string;
  path: string;
};

/** Frame references for the uploaded media that made it to "ready". */
export function buildForkyAttachmentRefs(attachments: ForkyAttachment[]): ForkyAttachmentRef[] {
  return attachments
    .filter((a) => a.status === "ready" && a.url && a.path)
    .map((a) => ({ name: a.name, media_type: a.mime || "application/octet-stream", size: a.size, url: a.url!, path: a.path! }));
}

/** Accept-list check mirroring FORKY_ATTACH_ACCEPT (the input's accept is a hint,
 *  not enforcement — drag-and-drop and OS quirks can bypass it). */
export function isAcceptedForkyFile(file: { name: string; type: string }): boolean {
  const mime = file.type.toLowerCase();
  const ext = forkyAttachmentExtension(file.name);
  if (mime.startsWith("image/")) return true;
  if (TEXTUAL_EXTENSIONS.has(ext)) return true;
  return ["pdf", "docx", "xlsx"].includes(ext);
}

export function formatForkyBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Validate a picked batch against the caps. `currentCount` is how many chips
 *  are already attached — the per-message cap covers the whole composer. */
export function validateForkyFiles(files: File[], currentCount = 0): ForkyFileValidation {
  const accepted: File[] = [];
  const rejected: ForkyAttachmentRejection[] = [];
  for (const file of files) {
    if (!isAcceptedForkyFile(file)) {
      rejected.push({ file, reason: `Tipo de archivo no admitido (${file.type || forkyAttachmentExtension(file.name) || "desconocido"})` });
    } else if (file.size > FORKY_ATTACH_MAX_BYTES) {
      rejected.push({ file, reason: `Supera el límite de ${formatForkyBytes(FORKY_ATTACH_MAX_BYTES)} (${formatForkyBytes(file.size)})` });
    } else if (currentCount + accepted.length >= FORKY_ATTACH_MAX_FILES) {
      rejected.push({ file, reason: `Máximo ${FORKY_ATTACH_MAX_FILES} archivos por mensaje` });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

/**
 * Read a text-capable file's contents, capped at FORKY_ATTACH_MAX_TEXT_CHARS.
 * Returns null for files that can't be extracted (metadata-only attachments).
 * Throws on real read failures — the caller turns that into an error chip.
 */
export async function extractForkyAttachmentText(file: File): Promise<string | null> {
  if (!isTextualAttachment(file)) return null;
  const raw = await file.text();
  if (raw.length <= FORKY_ATTACH_MAX_TEXT_CHARS) return raw;
  return `${raw.slice(0, FORKY_ATTACH_MAX_TEXT_CHARS)}\n[…texto truncado a ${FORKY_ATTACH_MAX_TEXT_CHARS} caracteres]`;
}

export type ForkyUploadResult = { url: string; path: string; contentType: string; size: number };

/**
 * Upload a media attachment to the restaurant's Bunny storage through the
 * existing REST endpoint (multipart "file"). XHR (not fetch) because the chip
 * shows real 0-100 progress from upload events. Rejects with the server's
 * error message so the chip can show an honest failure.
 */
export function uploadForkyAttachment(file: File, onProgress?: (percent: number) => void): Promise<ForkyUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", FORKY_ATTACH_UPLOAD_URL);
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as { success?: boolean; url?: string; path?: string; content_type?: string; size?: number; error?: string };
      if (xhr.status >= 200 && xhr.status < 300 && body.success && body.url && body.path) {
        onProgress?.(100);
        resolve({ url: body.url, path: body.path, contentType: body.content_type ?? file.type, size: body.size ?? file.size });
        return;
      }
      reject(new Error(body.error || `Error subiendo el archivo (HTTP ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Error de red subiendo el archivo"));
    xhr.onabort = () => reject(new Error("Subida cancelada"));

    const form = new FormData();
    form.append("file", file, file.name);
    xhr.send(form);
  });
}

let attachmentSeq = 0;
export function nextForkyAttachmentId(): string {
  attachmentSeq += 1;
  return `a${Date.now().toString(36)}-${attachmentSeq}`;
}

function attachmentKindLine(a: ForkyAttachment): string {
  const meta = `${a.name} · ${a.mime || "desconocido"} · ${formatForkyBytes(a.size)}`;
  if (a.status === "error") {
    return `[Adjunto: ${meta}] — ERROR: no se pudo preparar el archivo (${a.error ?? "fallo de lectura"})`;
  }
  if (a.text !== undefined && a.text !== null) {
    return `[Adjunto: ${meta}] — contenido:\n<<<BEGIN_FILE:${a.name}>>>\n${a.text}\n<<<END_FILE:${a.name}>>>`;
  }
  if (a.url && a.path) {
    // Uploaded media does NOT ride the content: the frame carries its
    // reference and the server hands the model a real image/document block
    // (coord forky_attachments_v1). No fake "metadata-only" note needed —
    // and never a claim that the model saw pixels from a URL.
    return "";
  }
  const note = a.mime.startsWith("image/")
    ? "imagen adjunta (solo metadatos: el contenido no llegó a subirse)"
    : "archivo adjunto (solo metadatos: el contenido no es extraíble en el cliente)";
  return `[Adjunto: ${meta}] — ${note}`;
}

/**
 * Compose the WS message content: the user's text plus one honest, delimited
 * block per TEXT attachment. Uploaded media (images/PDFs) travels separately
 * as frame attachment refs — not here. This is the entire integration with
 * the text part of the request path.
 */
export function buildForkyMessageContent(text: string, attachments: ForkyAttachment[]): string {
  const real = attachments.filter((a) => a.status !== "error" || a.error);
  const body = text.trim();
  const blocks = real
    .map(attachmentKindLine)
    .filter((line) => line !== "")
    .join("\n\n");
  if (!blocks) return body;
  return body ? `${body}\n\n${blocks}` : blocks;
}
