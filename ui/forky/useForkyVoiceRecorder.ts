import { useCallback, useEffect, useRef, useState } from "react";

import {
  FORKY_VOICE_MAX_MS,
  pickForkyVoiceMime,
  type ForkyVoiceMime,
} from "./forkyVoice";

// Forky F3 — the MediaRecorder lifecycle for the prompt-bar mic.
//
// States: idle → recording → (stop|cancel) → idle. `stop()` resolves with the
// encoded clip; the caller (ChatComposer) then uploads + transcribes it. Every
// teardown path stops the mic tracks — a leaked getUserMedia stream keeps the
// tab's recording indicator on, which users read as "still listening".

export type ForkyRecorderPhase = "idle" | "recording";

export type ForkyVoiceClip = { blob: Blob; mime: string; durationMs: number };

export function useForkyVoiceRecorder(): {
  phase: ForkyRecorderPhase;
  elapsedMs: number;
  /** null when the browser cannot record audio at all */
  unsupported: boolean;
  start: () => Promise<void>;
  stop: () => Promise<ForkyVoiceClip | null>;
  cancel: () => void;
} {
  const [phase, setPhase] = useState<ForkyRecorderPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [unsupported, setUnsupported] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedRef = useRef<((clip: ForkyVoiceClip | null) => void) | null>(null);

  const teardown = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    recorderRef.current = null;
    stoppedRef.current = null;
    setPhase("idle");
    setElapsedMs(0);
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    const picked: ForkyVoiceMime | null =
      typeof MediaRecorder !== "undefined"
        ? pickForkyVoiceMime((mime) => MediaRecorder.isTypeSupported(mime))
        : null;
    if (!picked) {
      setUnsupported(true);
      throw new Error("Este navegador no puede grabar audio");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new Error("Permiso de micrófono denegado");
    }
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream, { mimeType: picked.mime });
    recorderRef.current = recorder;
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const durationMs = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: picked.mime });
      const resolver = stoppedRef.current;
      teardown();
      resolver?.({ blob, mime: picked.mime, durationMs });
    };
    recorder.start(250);
    setPhase("recording");
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(elapsed);
      // Auto-stop at the cap: the clip still resolves through onstop.
      if (elapsed >= FORKY_VOICE_MAX_MS) recorder.state !== "inactive" && recorder.stop();
    }, 200);
  }, [teardown]);

  const stop = useCallback((): Promise<ForkyVoiceClip | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      teardown();
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      stoppedRef.current = resolve;
      // Safety net: if onstop never fires, fail honestly instead of hanging.
      const fallback = setTimeout(() => {
        if (stoppedRef.current === resolve) {
          teardown();
          resolve(null);
        }
      }, 3000);
      const wrapped: typeof resolve = (clip) => {
        clearTimeout(fallback);
        resolve(clip);
      };
      stoppedRef.current = wrapped;
      recorder.stop();
    });
  }, [teardown]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    stoppedRef.current = null; // discard the clip
    if (recorder && recorder.state !== "inactive") {
      recorder.stop(); // onstop runs teardown; resolver is null → clip dropped
    } else {
      teardown();
    }
  }, [teardown]);

  return { phase, elapsedMs, unsupported, start, stop, cancel };
}
