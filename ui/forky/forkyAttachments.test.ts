import { describe, expect, it } from "vitest";

import {
  buildForkyMessageContent,
  extractForkyAttachmentText,
  formatForkyBytes,
  FORKY_ATTACH_MAX_BYTES,
  FORKY_ATTACH_MAX_FILES,
  FORKY_ATTACH_MAX_TEXT_CHARS,
  isAcceptedForkyFile,
  isMediaAttachment,
  isTextualAttachment,
  nextForkyAttachmentId,
  buildForkyAttachmentRefs,
  validateForkyFiles,
  type ForkyAttachment,
} from "./forkyAttachments";

function fileOf(name: string, mime: string, size: number, body = "x"): File {
  // The bytes are never read in these tests — only name/type/size matter — so
  // the override stands in for the real payload (a 10 MB array is dog slow).
  const file = new File([body], name, { type: mime });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function attachmentOf(partial: Partial<ForkyAttachment> & { name: string }): ForkyAttachment {
  return {
    id: nextForkyAttachmentId(),
    file: fileOf(partial.name, "text/plain", 10),
    mime: "text/plain",
    size: 10,
    status: "ready",
    ...partial,
  };
}

describe("validateForkyFiles", () => {
  it("accepts images and text documents within the caps", () => {
    const { accepted, rejected } = validateForkyFiles([
      fileOf("foto.png", "image/png", 1000),
      fileOf("ventas.csv", "text/csv", 1000),
    ]);
    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(0);
  });

  it("rejects files over the 10 MB cap with an honest reason", () => {
    const { accepted, rejected } = validateForkyFiles([fileOf("big.png", "image/png", FORKY_ATTACH_MAX_BYTES + 1)]);
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toContain("10.0 MB");
  });

  it("rejects unsupported types", () => {
    const { accepted, rejected } = validateForkyFiles([fileOf("virus.exe", "application/x-msdownload", 10)]);
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toContain("no admitido");
  });

  it("enforces the per-message file cap across batches", () => {
    const first = validateForkyFiles(Array.from({ length: FORKY_ATTACH_MAX_FILES }, (_, i) => fileOf(`a${i}.txt`, "text/plain", 1)));
    expect(first.accepted).toHaveLength(FORKY_ATTACH_MAX_FILES);
    const second = validateForkyFiles([fileOf("b.txt", "text/plain", 1)], FORKY_ATTACH_MAX_FILES);
    expect(second.accepted).toHaveLength(0);
    expect(second.rejected[0].reason).toContain("Máximo");
  });

  it("accept-list mirrors the picker accept attribute", () => {
    expect(isAcceptedForkyFile({ name: "a.pdf", type: "application/pdf" })).toBe(true);
    expect(isAcceptedForkyFile({ name: "a.xlsx", type: "" })).toBe(true);
    expect(isAcceptedForkyFile({ name: "a.mp4", type: "video/mp4" })).toBe(false);
  });
});

describe("extractForkyAttachmentText", () => {
  it("returns the text of textual files", async () => {
    const file = fileOf("notas.md", "text/markdown", 5, "hola");
    const text = await extractForkyAttachmentText(file);
    expect(text).toContain("hola");
  });

  it("caps long files with an explicit truncation marker", async () => {
    const body = "a".repeat(FORKY_ATTACH_MAX_TEXT_CHARS + 500);
    const file = fileOf("grande.csv", "text/csv", body.length, body);
    const text = await extractForkyAttachmentText(file);
    expect(text).not.toBeNull();
    expect(text!.length).toBeLessThan(body.length);
    expect(text).toContain("truncado");
  });

  it("returns null for non-extractable files (images, pdf)", async () => {
    expect(await extractForkyAttachmentText(fileOf("foto.png", "image/png", 10))).toBeNull();
    expect(await extractForkyAttachmentText(fileOf("doc.pdf", "application/pdf", 10))).toBeNull();
  });

  it("classifies textual vs binary files", () => {
    expect(isTextualAttachment({ name: "a.json", type: "" })).toBe(true);
    expect(isTextualAttachment({ name: "b.txt", type: "text/plain" })).toBe(true);
    expect(isTextualAttachment({ name: "c.png", type: "image/png" })).toBe(false);
  });
});

describe("media attachments (upload to Bunny, coord forky_attachments_v1)", () => {
  it("classifies images and PDFs as media; textual files and SVG stay inline", () => {
    expect(isMediaAttachment({ name: "foto.jpg", type: "image/jpeg" })).toBe(true);
    expect(isMediaAttachment({ name: "doc.pdf", type: "application/pdf" })).toBe(true);
    expect(isMediaAttachment({ name: "doc.pdf", type: "" })).toBe(true);
    expect(isMediaAttachment({ name: "notas.txt", type: "text/plain" })).toBe(false);
    expect(isMediaAttachment({ name: "logo.svg", type: "image/svg+xml" })).toBe(false);
    expect(isMediaAttachment({ name: "tabla.csv", type: "text/csv" })).toBe(false);
  });

  it("builds frame refs only from uploaded (ready + url + path) attachments", () => {
    const refs = buildForkyAttachmentRefs([
      attachmentOf({ name: "foto.png", mime: "image/png", size: 2048, status: "uploading", progress: 40 }),
      attachmentOf({ name: "lista.txt", mime: "text/plain", size: 10, text: "a,b" }),
      attachmentOf({ name: "doc.pdf", mime: "application/pdf", size: 4096, url: "https://cdn.example/forky/1/doc.pdf", path: "forky/1/doc.pdf" }),
      attachmentOf({ name: "roto.png", mime: "image/png", size: 12, status: "error", error: "denied" }),
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({
      name: "doc.pdf",
      media_type: "application/pdf",
      size: 4096,
      url: "https://cdn.example/forky/1/doc.pdf",
      path: "forky/1/doc.pdf",
    });
  });

  it("uploaded media rides NO content block (the frame ref carries it)", () => {
    const content = buildForkyMessageContent("mira", [
      attachmentOf({ name: "foto.png", mime: "image/png", size: 2048, url: "https://cdn.example/f.png", path: "forky/1/f.png" }),
    ]);
    expect(content).toBe("mira");
  });
});

describe("buildForkyMessageContent", () => {
  it("returns the bare text when nothing is attached", () => {
    expect(buildForkyMessageContent("hola", [])).toBe("hola");
  });

  it("appends a delimited block with extracted content for textual files", () => {
    const content = buildForkyMessageContent("resume esto", [
      attachmentOf({ name: "ventas.csv", mime: "text/csv", size: 1200, text: "mes,ventas\nenero,10" }),
    ]);
    expect(content).toContain("resume esto");
    expect(content).toContain("[Adjunto: ventas.csv · text/csv · 1.2 KB] — contenido:");
    expect(content).toContain("<<<BEGIN_FILE:ventas.csv>>>");
    expect(content).toContain("mes,ventas");
    expect(content).toContain("<<<END_FILE:ventas.csv>>>");
  });

  it("never pretends binary content was extracted (honest metadata note)", () => {
    const content = buildForkyMessageContent("mira", [
      attachmentOf({ name: "foto.png", mime: "image/png", size: 2048 }),
      attachmentOf({ name: "doc.pdf", mime: "application/pdf", size: 4096 }),
    ]);
    expect(content).toContain("solo metadatos");
    expect(content).not.toContain("BEGIN_FILE");
  });

  it("surfaces read failures as explicit ERROR blocks", () => {
    const content = buildForkyMessageContent("", [
      attachmentOf({ name: "roto.txt", status: "error", error: "denied" }),
    ]);
    expect(content).toContain("ERROR: no se pudo preparar el archivo (denied)");
  });

  it("works with attachments but no text", () => {
    const content = buildForkyMessageContent("", [
      attachmentOf({ name: "a.csv", mime: "text/csv", size: 10, text: "a,b" }),
    ]);
    expect(content.startsWith("[Adjunto: a.csv")).toBe(true);
  });

  it("formats sizes for humans", () => {
    expect(formatForkyBytes(512)).toBe("512 B");
    expect(formatForkyBytes(1200)).toBe("1.2 KB");
    expect(formatForkyBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
