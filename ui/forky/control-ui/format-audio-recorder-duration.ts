// Vendored from Control UI (https://control-ui.dev) — registry item `audio-recorder`
// (kit file format-audio-recorder-duration), installed 2026-10-13 (coord forky_media_transcribe_v1).

export function formatAudioRecorderDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}
