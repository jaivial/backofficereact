// Forky prompt-bar voice (coord forky_media_transcribe_v1).
// Host wrapper around the vendored Control UI `use-audio-recorder`
// (ui/forky/control-ui/use-audio-recorder.ts): it captures the clip, then
// uploads it to the restaurant's Bunny storage and transcribes it with the
// app's STT path (bot-pipeline faster-whisper). The transcript — not the
// audio — is what goes to the text model; the clip's Bunny URL rides along as
// a [forky-voice] marker so the bubble can render a player.
"use client";

import { useCallback, useRef, useState } from "react";
import { useAudioRecorder } from "./control-ui/use-audio-recorder";
import { createClient } from "../../api/client";
import { audioExtension, forkVoiceMarker, transcribeAudio, uploadAssistantMedia } from "./forkyVoice";

export type UseForkyVoiceOptions = {
  /** Fired once the clip is stored: the transcript (may be "") and its Bunny URL. */
  onVoiceMessage: (transcript: string, url: string | null) => void;
};

export function useForkyVoice({ onVoiceMessage }: UseForkyVoiceOptions) {
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const onVoiceMessageRef = useRef(onVoiceMessage);
  onVoiceMessageRef.current = onVoiceMessage;

  const recorder = useAudioRecorder({
    onRecordingComplete: async (recording) => {
      setVoiceBusy(true);
      setVoiceError(null);
      const api = createClient();
      try {
        // 1. The clip itself lands in Bunny so the bubble can play it back.
        const ext = audioExtension(recording.mimeType);
        const file = new File([recording.blob], `nota-de-voz.${ext}`, { type: recording.mimeType });
        const { url } = await uploadAssistantMedia(api, file);
        // 2. STT. If transcription fails the clip still sends, but only as a
        //    player — the model is never told a transcript that doesn't exist.
        let transcript = "";
        try {
          transcript = (await transcribeAudio(api, recording.blob)).text.trim();
        } catch {
          transcript = "";
        }
        onVoiceMessageRef.current(transcript, url);
      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : "No se pudo enviar la nota de voz");
      } finally {
        setVoiceBusy(false);
      }
    },
  });

  const dictating = recorder.state === "recording" || recorder.state === "requesting";

  const toggle = useCallback(() => {
    if (voiceBusy) return;
    if (dictating) {
      void recorder.stop();
    } else {
      setVoiceError(null);
      void recorder.start();
    }
  }, [dictating, recorder, voiceBusy]);

  const cancel = useCallback(() => {
    if (dictating) recorder.cancel();
  }, [dictating, recorder]);

  const clearError = useCallback(() => setVoiceError(null), []);

  return {
    dictating,
    voiceBusy,
    voiceError,
    clearError,
    durationMs: recorder.durationMs,
    levels: recorder.levels,
    toggle,
    cancel,
  };
}
