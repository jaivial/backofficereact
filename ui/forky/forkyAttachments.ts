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

/** Picker accept list: images + documents. Binary docs ride as metadata only. */
export const FORKY_ATTACH_ACCEPT =
  "image/*,.pdf,.txt,.md,.markdown,.csv,.tsv,.json,.log,.xml,.yml,.yaml,.html,.js,.ts,.tsx,.jsx,.py,.go,.sql,.docx,.xlsx";

export type ForkyAttachmentStatus = "reading" | "ready" | "error";

export type ForkyAttachment = {
  id: string;
  file: File;
  name: string;
  mime: string;
  size: number;
  status: ForkyAttachmentStatus;
  /** Extracted text (text-capable files) once status is "ready". */
  text?: string;
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

let attachmentSeq = 0;
export function nextForkyAttachmentId(): string {
  attachmentSeq += 1;
  return `a${Date.now().toString(36)}-${attachmentSeq}`;
}

function attachmentKindLine(a: ForkyAttachment): string {
  const meta = `${a.name} · ${a.mime || "desconocido"} · ${formatForkyBytes(a.size)}`;
  if (a.status === "error") {
    return `[Adjunto: ${meta}] — ERROR: no se pudo leer el archivo (${a.error ?? "fallo de lectura"})`;
  }
  if (a.text !== undefined && a.text !== null) {
    return `[Adjunto: ${meta}] — contenido:\n<<<BEGIN_FILE:${a.name}>>>\n${a.text}\n<<<END_FILE:${a.name}>>>`;
  }
  const note = a.mime.startsWith("image/")
    ? "imagen adjunta (solo metadatos: el cliente no puede extraer el contenido de la imagen)"
    : "archivo adjunto (solo metadatos: el contenido no es extraíble en el cliente)";
  return `[Adjunto: ${meta}] — ${note}`;
}

/**
 * Compose the WS message content: the user's text plus one honest, delimited
 * block per attachment. This is the entire integration with the AI request
 * path — no protocol change, the attachments ride the existing `content`.
 */
export function buildForkyMessageContent(text: string, attachments: ForkyAttachment[]): string {
  const real = attachments.filter((a) => a.status !== "error" || a.error);
  const body = text.trim();
  if (real.length === 0) return body;
  const blocks = real.map(attachmentKindLine).join("\n\n");
  return body ? `${body}\n\n${blocks}` : blocks;
}
