import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuiState } from "@assistant-ui/react";

import {
  formatForkyVoiceClock,
  lookupForkyVoiceMessage,
  subscribeForkyVoiceMessages,
  getForkyVoiceMessagesVersion,
} from "./forkyVoice";

// Forky F3 — the voice-note player for the chat bubble.
//
// Control UI ships no audio primitives (only attachment chip / spinner /
// live-status), so this is the "equivalent bui component": fui tokens, the
// registry mic silhouette and a thin progress track. Duration truth: the
// measured recording time — MediaRecorder's webm container often reports
// Infinity in `loadedmetadata` (well-known Chrome gap), so a finite reported
// duration refines the clock but an Infinite one never replaces it.

export function VoicePlayer({ url, durationMs }: { url: string; durationMs: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(durationMs);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentMs(audio.currentTime * 1000);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setTotalMs(audio.duration * 1000);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrentMs(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [url]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(totalMs) || totalMs <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = (ratio * totalMs) / 1000;
    setCurrentMs(ratio * totalMs);
  }, [totalMs]);

  const progress = totalMs > 0 ? Math.min(100, (currentMs / totalMs) * 100) : 0;

  return (
    <div
      data-testid="forky-voice-player"
      className="flex min-w-[180px] items-center gap-2.5 rounded-[10px] bg-fui-field px-2.5 py-1.5"
      style={{ boxShadow: "var(--fui-shadow-btn)" }}
    >
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        type="button"
        data-testid="forky-voice-play"
        aria-label={playing ? "Pausar nota de voz" : "Reproducir nota de voz"}
        onClick={toggle}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-fui-ink transition-transform duration-150 active:scale-[0.94]"
        style={{ background: "var(--fui-surface)", boxShadow: "var(--fui-shadow-btn)" }}
      >
        {playing ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <rect x="1.5" y="1" width="3" height="10" rx="1" />
            <rect x="7.5" y="1" width="3" height="10" rx="1" />
          </svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
            <path d="M3 1.6c0-.8.9-1.3 1.6-.9l6 3.6c.7.4.7 1.4 0 1.8l-6 3.6c-.7.4-1.6-.1-1.6-.9V1.6z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          data-testid="forky-voice-progress"
          onClick={seek}
          role="slider"
          aria-label="Progreso de la nota de voz"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalMs)}
          aria-valuenow={Math.round(currentMs)}
          tabIndex={0}
          className="h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-fui-line"
        >
          <div className="h-full rounded-full bg-fui-ink transition-[width] duration-150" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] tabular-nums text-fui-ink-3">
          <span data-testid="forky-voice-current">{formatForkyVoiceClock(currentMs)}</span>
          <span data-testid="forky-voice-total">{formatForkyVoiceClock(totalMs)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders the voice player inside the user bubble when the message carries a
 * registered clip. The registry is external (filled by the model adapter the
 * moment the turn starts), so the subscription goes through
 * useSyncExternalStore instead of component state.
 */
export function VoiceMessageSlot() {
  const messageId = useAuiState((s) => s.message.id);
  useSyncExternalStore(subscribeForkyVoiceMessages, getForkyVoiceMessagesVersion);
  const voice = lookupForkyVoiceMessage(messageId);
  if (!voice) return null;
  return (
    <div className="mt-1.5" data-testid="forky-voice-message">
      <VoicePlayer url={voice.url} durationMs={voice.durationMs} />
    </div>
  );
}

