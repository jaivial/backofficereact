import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuiState } from "@assistant-ui/react";

import { AudioVisualizer } from "../../components/control-ui/ui/audio-visualizer";
import {
  forkyVoiceWaveform,
  formatForkyVoiceClock,
  lookupForkyVoiceMessage,
  subscribeForkyVoiceMessages,
  getForkyVoiceMessagesVersion,
  type ForkyVoiceMessageMeta,
} from "./forkyVoice";

// Forky F3 — the voice-note player for the chat bubble.
//
// Bars come from control-ui.dev's r/audio-visualizer (alternative=bars),
// vendored in components/control-ui/ui/audio-visualizer.tsx and painted by the
// recipe in components/styles/features/forky/forky-control-ui.css (scoped to
// the BuiIsland like every other Control UI recipe installed here).
//
// The shape is the clip's own seeded waveform (forkyVoiceWaveform — same URL,
// same bars, across renders and reloads); progress dims the unplayed tail
// through a mask, so the bar reads as a fill from the left while audio plays.
// Duration truth stays what it always was: the measured recording time —
// MediaRecorder's webm container often reports Infinity in `loadedmetadata`
// (well-known Chrome gap), so a finite reported duration refines the clock but
// an Infinite one never replaces it.

/** Alpha left of the playhead; the unplayed tail keeps this much of the bars. */
const UNPLAYED_ALPHA = 0.3;

export function VoicePlayer({ url, durationMs }: { url: string; durationMs: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(durationMs);

  const levels = useMemo(() => forkyVoiceWaveform(url), [url]);

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

  const seekTo = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(totalMs) || totalMs <= 0) return;
    const next = Math.min(1, Math.max(0, ratio));
    audio.currentTime = (next * totalMs) / 1000;
    setCurrentMs(next * totalMs);
  }, [totalMs]);

  const seek = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      seekTo((event.clientX - rect.left) / rect.width);
    },
    [seekTo],
  );

  // Focusable slider: arrows step 5 s, Home/End jump to the ends. A Map keeps
  // prototype keys ("constructor", "toString", …) out of the lookup: an
  // inherited function would compute a NaN position for currentTime.
  const seekByKey = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 5000;
      const positions = new Map<string, number>([
        ["ArrowLeft", currentMs - step],
        ["ArrowDown", currentMs - step],
        ["ArrowRight", currentMs + step],
        ["ArrowUp", currentMs + step],
        ["Home", 0],
        ["End", totalMs],
      ]);
      const next = positions.get(event.key);
      if (next === undefined) return;
      event.preventDefault();
      seekTo(totalMs > 0 ? next / totalMs : 0);
    },
    [currentMs, seekTo, totalMs],
  );

  const progress = totalMs > 0 ? Math.min(1, Math.max(0, currentMs / totalMs)) : 0;
  const playedPct = Math.round(progress * 100);
  const mask = `linear-gradient(to right, #000 ${playedPct}%, rgba(0, 0, 0, ${UNPLAYED_ALPHA}) ${playedPct}%)`;

  return (
    <div
      data-testid="forky-voice-player"
      className="flex min-w-[210px] max-w-full items-center gap-2.5 rounded-[10px] bg-fui-field px-2.5 py-1.5"
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
            <path d="M3 1.6c0-.8.9-1.3 1.6-.9l6 3.6c.7.4.7 1.4 0 1.8l-6 3.6c-.7.4-1.6.1-1.6-.9V1.6z" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          data-testid="forky-voice-progress"
          onClick={seek}
          onKeyDown={seekByKey}
          role="slider"
          aria-label="Progreso de la nota de voz"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalMs)}
          aria-valuenow={Math.round(currentMs)}
          aria-valuetext={`${formatForkyVoiceClock(currentMs)} de ${formatForkyVoiceClock(totalMs)}`}
          tabIndex={0}
          className="relative h-7 w-full cursor-pointer overflow-hidden rounded-[6px] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fui-ink-2"
        >
          <div
            className="absolute inset-0"
            style={{
              maskImage: mask,
              WebkitMaskImage: mask,
              // Pin the gradient to the box: the default `auto` would otherwise
              // stretch with the bar when the layout reflows.
              maskSize: "100% 100%",
              WebkitMaskSize: "100% 100%",
            }}
          >
            {/* points=levels.length: audioVisualizerPointCount defaults to 28 and
                would silently drop the first bars of a longer seed. */}
            <AudioVisualizer levels={levels} points={levels.length} active className="h-full w-full" />
          </div>
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
 * The clip meta for the message being rendered, or null for a plain text turn.
 * Subscribed through useSyncExternalStore: the registry is external — filled by
 * the model adapter when a voice turn starts and by seedHistory when the hello
 * frame replays an audio message — so the bubble swaps to a player whenever it
 * lands, live or after a reload.
 */
export function useForkyVoiceMessage(): ForkyVoiceMessageMeta | null {
  const messageId = useAuiState((s) => s.message.id);
  useSyncExternalStore(subscribeForkyVoiceMessages, getForkyVoiceMessagesVersion);
  return lookupForkyVoiceMessage(messageId);
}
