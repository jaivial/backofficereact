// Forky F3 — voice notes: record (host) → Bunny upload → transcript → player.
//
// Division of labor: the transport endpoints already exist server-side
// (coord forky_media_transcribe_v1):
//   POST /api/admin/assistant/media/upload  (multipart "file") → Bunny pull URL
//   POST /api/admin/assistant/transcribe    ({ audio_b64 })    → whisper transcript
// Audio does NOT ride the WS `attachments[]` frame: that allowlist is
// image/pdf/text only (the model is text-only and never "hears" audio) — the
// transcript IS the payload, and the clip's Bunny URL feeds the player UI.
// Everything here is pure (or fetch-injectable) and unit-tested; the
// MediaRecorder lifecycle lives in useForkyVoiceRecorder.

export const FORKY_VOICE_TRANSCRIBE_URL = "/api/admin/assistant/transcribe";

/** Hard cap on one voice note; the UI auto-stops here. */
export const FORKY_VOICE_MAX_MS = 60_000;
/** Hard cap on the encoded clip (matches the attachment cap; 60 s of Opus is ~0.5 MB). */
export const FORKY_VOICE_MAX_BYTES = 10 * 1024 * 1024;

export type ForkyVoiceMime = { mime: string; ext: string };

/** Encoding preference order: Opus-in-webm first (Chrome/Firefox), then the
 *  Safari family (mp4/AAC), then ogg. `isTypeSupported` decides. */
const VOICE_MIME_CANDIDATES: ForkyVoiceMime[] = [
  { mime: "audio/webm;codecs=opus", ext: "webm" },
  { mime: "audio/webm", ext: "webm" },
  { mime: "audio/mp4", ext: "m4a" },
  { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  { mime: "audio/ogg", ext: "ogg" },
];

/** Best recording encoding this browser supports, or null when MediaRecorder
 *  cannot do audio at all (the mic button then shows an honest error). */
export function pickForkyVoiceMime(isSupported: (mime: string) => boolean): ForkyVoiceMime | null {
  for (const candidate of VOICE_MIME_CANDIDATES) {
    try {
      if (isSupported(candidate.mime)) return candidate;
    } catch {
      /* a throwing isTypeSupported counts as "not supported" */
    }
  }
  return null;
}

/** Stable, honest file name for the uploaded clip (server keeps it in Bunny). */
export function forkyVoiceFileName(timestampMs: number, ext: string): string {
  return `nota-voz-${new Date(timestampMs).toISOString().replace(/[:.]/g, "-")}.${ext}`;
}

/** File extension matching a recorded mime (the upload endpoint's allowlist is
 *  extension-based: webm/ogg/m4a/mp3/wav/aac). Falls back to .webm — the
 *  endpoint also sniffs content-type as a second chance. */
export function forkyVoiceExtension(mime: string): string {
  const clean = mime.toLowerCase().split(";")[0].trim();
  if (clean === "audio/mp4" || clean === "audio/m4a" || clean === "audio/aac") return "m4a";
  if (clean === "audio/ogg") return "ogg";
  if (clean === "audio/mpeg" || clean === "audio/mp3") return "mp3";
  if (clean === "audio/wav" || clean === "audio/x-wav") return "wav";
  return "webm";
}


/** m:ss clock for the recording timer and the player. */
export function formatForkyVoiceClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Blob → base64 (no data: prefix), chunked so btoa never blows the argument
 *  limit on long clips. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export type ForkyTranscript = { text: string; language: string };

/**
 * Send the clip to the STT endpoint. Throws with a user-facing Spanish message
 * on every failure mode (network, server error, empty transcript) — the caller
 * renders that verbatim instead of pretending the audio was heard.
 */
export async function transcribeForkyAudio(
  blob: Blob,
  fetchImpl: typeof fetch = fetch,
): Promise<ForkyTranscript> {
  if (blob.size === 0) throw new Error("La nota de voz está vacía");
  if (blob.size > FORKY_VOICE_MAX_BYTES) throw new Error("La nota de voz es demasiado larga");
  const audioB64 = await blobToBase64(blob);
  let response: Response;
  try {
    response = await fetchImpl(FORKY_VOICE_TRANSCRIBE_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_b64: audioB64 }),
    });
  } catch {
    throw new Error("Sin conexión con el servicio de transcripción");
  }
  let body: { success?: boolean; text?: string; language?: string; error?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    /* non-JSON body → handled below */
  }
  if (!response.ok || !body.success) {
    throw new Error(body.error || `Transcripción fallida (HTTP ${response.status})`);
  }
  const text = (body.text ?? "").trim();
  if (!text) throw new Error("No se ha detectado voz en la nota");
  return { text, language: body.language ?? "" };
}

// ---------------------------------------------------------------------------
// Voice-message registry — maps an appended user message id to the clip that
// produced it, so the bubble can render a player. The WS history only persists
// role+content, so (like every media in this chat) players do not survive a
// reload; the map is session-scoped and pruned to the last MAX entries.
// ---------------------------------------------------------------------------

export type ForkyVoiceMessageMeta = {
  /** Bunny pull URL of the uploaded clip. */
  url: string;
  /** Wall-clock duration measured while recording (MediaRecorder webm often
   *  reports Infinity; the measured value is the honest fallback). */
  durationMs: number;
};

const VOICE_MESSAGES_MAX = 60;
const voiceMessages = new Map<string, ForkyVoiceMessageMeta>();
const voiceListeners = new Set<() => void>();
let voiceVersion = 0;

function notifyVoiceListeners(): void {
  voiceVersion += 1;
  for (const listener of voiceListeners) listener();
}

/** Called by the model adapter when a turn carrying a voice note starts. */
export function registerForkyVoiceMessage(id: string, meta: ForkyVoiceMessageMeta): void {
  voiceMessages.set(id, meta);
  while (voiceMessages.size > VOICE_MESSAGES_MAX) {
    const oldest = voiceMessages.keys().next().value;
    if (oldest === undefined) break;
    voiceMessages.delete(oldest);
  }
  notifyVoiceListeners();
}

export function lookupForkyVoiceMessage(id: string): ForkyVoiceMessageMeta | null {
  return voiceMessages.get(id) ?? null;
}

export function subscribeForkyVoiceMessages(listener: () => void): () => void {
  voiceListeners.add(listener);
  return () => voiceListeners.delete(listener);
}

/** Monotonic version for useSyncExternalStore snapshots. */
export function getForkyVoiceMessagesVersion(): number {
  return voiceVersion;
}
