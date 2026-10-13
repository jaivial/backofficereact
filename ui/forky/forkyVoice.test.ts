import { describe, expect, it } from "vitest";
import {
  audioExtension,
  forkAttachMarker,
  forkVoiceMarker,
  parseForkyMarkers,
} from "./forkyVoice";

describe("forky media markers", () => {
  it("round-trips a voice marker", () => {
    const text = `transcripción ${forkVoiceMarker("https://cdn/x/clip.webm")}`;
    expect(parseForkyMarkers(text)).toEqual([
      { type: "text", text: "transcripción" },
      { type: "voice", url: "https://cdn/x/clip.webm" },
    ]);
  });

  it("round-trips an attach marker with quotes stripped from the name", () => {
    const text = forkAttachMarker('menu"verano', "https://cdn/x/menu.pdf");
    expect(text).toBe('[forky-attach name="menuverano" url="https://cdn/x/menu.pdf"]');
    expect(parseForkyMarkers(text)).toEqual([
      { type: "attach", name: "menuverano", url: "https://cdn/x/menu.pdf" },
    ]);
  });

  it("keeps plain text untouched", () => {
    expect(parseForkyMarkers("hola")).toEqual([{ type: "text", text: "hola" }]);
    expect(parseForkyMarkers("")).toEqual([]);
  });

  it("splits mixed messages in order", () => {
    const text = [
      forkVoiceMarker("https://cdn/a.webm"),
      "mira esto",
      forkAttachMarker("summer-menu.pdf", "https://cdn/b.pdf"),
    ].join(" ");
    expect(parseForkyMarkers(text)).toEqual([
      { type: "voice", url: "https://cdn/a.webm" },
      { type: "text", text: "mira esto" },
      { type: "attach", name: "summer-menu.pdf", url: "https://cdn/b.pdf" },
    ]);
  });
});

describe("audioExtension", () => {
  it("maps recorder mime types to backend-allowed extensions", () => {
    expect(audioExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtension("audio/ogg")).toBe("ogg");
    expect(audioExtension("audio/mp4")).toBe("m4a");
    expect(audioExtension("audio/mpeg")).toBe("mp3");
    expect(audioExtension("audio/wav")).toBe("wav");
    expect(audioExtension("")).toBe("webm");
  });
});
