// Forky prompt-bar media plumbing (coord forky_media_transcribe_v1).
//
// Voice notes and attachments ride the normal text WebSocket as honest text
// markers plus the transcript/file reference. The text model never "hears"
// audio: the clip is transcribed first (faster-whisper via the bot pipeline,
// through POST /api/admin/assistant/transcribe) and only the transcript is
// sent. Markers double as the UI's render hooks:
//
//   [forky-voice url="<bunny url>"]     — a voice note; bubble renders a player
//   [forky-attach name="n" url="u"]     — a file attachment; bubble renders a chip
import { createClient } from "../../api/client";

type ApiClient = ReturnType<typeof createClient>;

export type ForkyAttachmentChip = {
  id: string;
  name: string;
  status: "uploading" | "ready" | "error";
  error?: string;
  previewUrl?: string;
  kind?: "image" | "document";
  url?: string;
};

export function forkVoiceMarker(url: string): string {
  return `[forky-voice url="${url}"]`;
}

export function forkAttachMarker(name: string, url: string): string {
  return `[forky-attach name="${name.replace(/[\\"\]]/g, "")}" url="${url}"]`;
}

export type ForkyVoicePart =
  | { type: "text"; text: string }
  | { type: "voice"; url: string }
  | { type: "attach"; name: string; url: string };

const MARKER_RE = /\[(forky-voice|forky-attach)(?:[^\]]*)\]/g;

/** Split a message's text into renderable parts, extracting the markers. */
export function parseForkyMarkers(text: string): ForkyVoicePart[] {
  const parts: ForkyVoicePart[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKER_RE)) {
    const start = match.index ?? 0;
    if (start > last) {
      const between = text.slice(last, start).trim();
      if (between) parts.push({ type: "text", text: between });
    }
    if (match[1] === "forky-voice") {
      const url = /url="([^"]*)"/.exec(match[0])?.[1] ?? "";
      parts.push({ type: "voice", url });
    } else {
      const url = /url="([^"]*)"/.exec(match[0])?.[1] ?? "";
      const name = /name="([^"]*)"/.exec(match[0])?.[1] ?? "archivo";
      parts.push({ type: "attach", name, url });
    }
    last = start + match[0].length;
  }
  const rest = text.slice(last).trim();
  if (rest) parts.push({ type: "text", text: rest });
  return parts;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("read_failed"));
    reader.readAsDataURL(blob);
  });
}

/** MediaRecorder mime → file extension the backend allowlist accepts. */
export function audioExtension(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export type AssistantUploadResult = { url: string; name: string };

/** Upload one clip/file to the restaurant's Bunny storage via the backend. */
export async function uploadAssistantMedia(
  api: ApiClient,
  file: File | Blob,
  name?: string,
): Promise<AssistantUploadResult> {
  const res = await api.config.uploadAssistantMedia(file, name);
  if (!res.success) throw new Error((res as { error?: string; message?: string }).error ?? res.message ?? "upload_failed");
  return { url: res.url, name: res.name || name || "archivo" };
}

export type TranscriptResult = { text: string; language: string };

/** Transcribe a clip with the app's STT path (bot pipeline faster-whisper). */
export async function transcribeAudio(api: ApiClient, blob: Blob): Promise<TranscriptResult> {
  const audioB64 = await blobToBase64(blob);
  const res = await api.config.transcribeAssistantAudio(audioB64);
  if (!res.success) throw new Error((res as { error?: string; message?: string }).error ?? res.message ?? "transcribe_failed");
  return { text: res.text, language: res.language };
}
