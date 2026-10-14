import { describe, expect, it } from "vitest";

import {
  blobToBase64,
  forkyVoiceExtension,
  forkyVoiceFileName,
  formatForkyVoiceClock,
  FORKY_VOICE_MAX_MS,
  lookupForkyVoiceMessage,
  pickForkyVoiceMime,
  registerForkyVoiceMessage,
  subscribeForkyVoiceMessages,
  getForkyVoiceMessagesVersion,
  transcribeForkyAudio,
  type ForkyVoiceMessageMeta,
} from "./forkyVoice";

describe("pickForkyVoiceMime", () => {
  it("prefers opus-in-webm and falls through in order", () => {
    const supported: string[] = ["audio/ogg", "audio/mp4"];
    expect(pickForkyVoiceMime((m) => supported.includes(m))?.mime).toBe("audio/mp4");
    supported.push("audio/webm;codecs=opus");
    expect(pickForkyVoiceMime((m) => supported.includes(m))?.mime).toBe("audio/webm;codecs=opus");
  });

  it("returns null when nothing is supported", () => {
    expect(pickForkyVoiceMime(() => false)).toBeNull();
  });

  it("treats a throwing isTypeSupported as unsupported", () => {
    expect(pickForkyVoiceMime(() => { throw new Error("boom"); })).toBeNull();
  });
});

describe("forkyVoiceFileName / forkyVoiceExtension", () => {
  it("builds a stable, extension-suffixed name", () => {
    const ts = Date.UTC(2026, 9, 14, 12, 34, 56);
    expect(forkyVoiceFileName(ts, "webm")).toMatch(/^nota-voz-2026-10-14T12-34-56-\d{3}Z\.webm$/);
  });

  it("maps mimes to allowlisted extensions", () => {
    expect(forkyVoiceExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(forkyVoiceExtension("audio/mp4")).toBe("m4a");
    expect(forkyVoiceExtension("audio/aac")).toBe("m4a");
    expect(forkyVoiceExtension("audio/ogg")).toBe("ogg");
    expect(forkyVoiceExtension("audio/mpeg")).toBe("mp3");
    expect(forkyVoiceExtension("audio/x-wav")).toBe("wav");
    expect(forkyVoiceExtension("")).toBe("webm");
  });
});

describe("formatForkyVoiceClock", () => {
  it("formats m:ss", () => {
    expect(formatForkyVoiceClock(0)).toBe("0:00");
    expect(formatForkyVoiceClock(5300)).toBe("0:05");
    expect(formatForkyVoiceClock(65_200)).toBe("1:05");
    expect(formatForkyVoiceClock(FORKY_VOICE_MAX_MS)).toBe("1:00");
  });
});

describe("blobToBase64", () => {
  it("encodes bytes without the data: prefix, across chunk boundaries", () => {
    const bytes = new Uint8Array(0x8000 + 7); // past one btoa chunk
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    const blob = new Blob([bytes]);
    return blobToBase64(blob).then((b64) => {
      expect(b64).not.toMatch(/^data:/);
      const round = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      expect(round).toEqual(bytes);
    });
  });
});

describe("transcribeForkyAudio", () => {
  const blobOf = (size = 10) => new Blob([new Uint8Array(size)], { type: "audio/webm" });

  it("posts audio_b64 and returns the transcript", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ success: true, text: "  ¿Qué reservas hay?  ", language: "es" }), { status: 200 });
    }) as typeof fetch;
    const out = await transcribeForkyAudio(blobOf(), fetchImpl);
    expect(out).toEqual({ text: "¿Qué reservas hay?", language: "es" });
    expect(calls[0].url).toBe("/api/admin/assistant/transcribe");
    const body = JSON.parse(String(calls[0].init.body)) as { audio_b64: string };
    expect(body.audio_b64.length).toBeGreaterThan(0);
  });

  it("surfaces the server error message", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: false, error: "Transcription unavailable" }), { status: 502 })) as typeof fetch;
    await expect(transcribeForkyAudio(blobOf(), fetchImpl)).rejects.toThrow("Transcription unavailable");
  });

  it("rejects an empty transcript honestly", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: true, text: "   " }), { status: 200 })) as typeof fetch;
    await expect(transcribeForkyAudio(blobOf(), fetchImpl)).rejects.toThrow("No se ha detectado voz");
  });

  it("maps network failure to a readable message", async () => {
    const fetchImpl = (async () => { throw new Error("offline"); }) as typeof fetch;
    await expect(transcribeForkyAudio(blobOf(), fetchImpl)).rejects.toThrow("Sin conexión con el servicio de transcripción");
  });

  it("rejects empty clips up front", async () => {
    const fetchImpl = (async () => new Response("{}", { status: 200 })) as typeof fetch;
    await expect(transcribeForkyAudio(new Blob([]), fetchImpl)).rejects.toThrow("vacía");
  });
});

describe("voice message registry", () => {
  const meta = (url: string): ForkyVoiceMessageMeta => ({ url, durationMs: 4200 });

  it("registers and looks up by message id", () => {
    registerForkyVoiceMessage("m-voice-1", meta("https://cdn/n1.webm"));
    expect(lookupForkyVoiceMessage("m-voice-1")?.url).toBe("https://cdn/n1.webm");
    expect(lookupForkyVoiceMessage("m-other")).toBeNull();
  });

  it("notifies subscribers and bumps the version", () => {
    const seen: number[] = [];
    const unsub = subscribeForkyVoiceMessages(() => seen.push(getForkyVoiceMessagesVersion()));
    const before = getForkyVoiceMessagesVersion();
    registerForkyVoiceMessage(`m-${before}`, meta("https://cdn/x.webm"));
    expect(seen.length).toBeGreaterThan(0);
    unsub();
    registerForkyVoiceMessage(`m-quiet-${before}`, meta("https://cdn/y.webm"));
    expect(seen).toHaveLength(seen.length); // no growth after unsubscribing
  });

  it("prunes to the cap, dropping the oldest", () => {
    for (let i = 0; i < 70; i++) registerForkyVoiceMessage(`m-prune-${i}`, meta(`https://cdn/p${i}.webm`));
    expect(lookupForkyVoiceMessage("m-prune-0")).toBeNull();
    expect(lookupForkyVoiceMessage("m-prune-69")?.url).toBe("https://cdn/p69.webm");
  });
});
