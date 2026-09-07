import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../actions/Button";
import { InlineAlert } from "../feedback/InlineAlert";

// Reusable markdown editor. Image insertion is delegated through `onUploadImage`
// so the editor never knows about a storage provider (only URLs are inserted,
// never blobs or base64). Client-only: the library touches `window` on import.

export type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  height?: number;
  placeholder?: string;
  testId: string;
  /** Coordination id shared with the backend for cross-boundary tracing. */
  coordId?: string;
};

type MDComponent = React.ComponentType<Record<string, unknown>>;

/**
 * Inserts `snippet` as its own block at `caret` (end of text when the caret is
 * unknown or stale), keeping the surrounding newlines markdown needs.
 */
export function insertMarkdownBlock(text: string, snippet: string, caret?: number): string {
  const at = typeof caret === "number" && caret >= 0 && caret <= text.length ? caret : text.length;
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = before === "" || before.endsWith("\n") ? "" : "\n";
  const trail = after === "" || after.startsWith("\n") ? "\n" : "\n\n";
  return `${before}${lead}${snippet}${trail}${after}`;
}

/** Markdown image whose alt text is the file name without its extension. */
export function markdownImage(fileName: string, url: string): string {
  return `![${fileName.replace(/\.[^.]+$/, "")}](${url})`;
}

export function MarkdownEditor({ value, onChange, onUploadImage, height = 420, placeholder, testId, coordId }: MarkdownEditorProps) {
  const [MD, setMD] = useState<MDComponent | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const caretRef = useRef<number | undefined>(undefined);
  // The upload is awaited, so `value` captured by the callback can be stale by
  // the time it resolves (the user keeps typing, the parent re-renders). The
  // insertion always reads the CURRENT text through this ref instead.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    let alive = true;
    void import("@uiw/react-md-editor").then((mod) => {
      if (alive) setMD(() => mod.default as unknown as MDComponent);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Records the caret while the user works on the textarea. Reading it when the
  // button is clicked is too late: the button already took the focus, and an
  // unfocused textarea reports offset 0 (which would push the image to the top).
  // Staying undefined until a real interaction means "append at the end".
  const trackCaret = useCallback((event: React.SyntheticEvent) => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) caretRef.current = target.selectionStart;
  }, []);

  const pickImage = useCallback(() => fileRef.current?.click(), []);

  const handleFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !onUploadImage) return;
      setUploading(true);
      setError("");
      try {
        const url = await onUploadImage(file);
        if (!url) throw new Error("La subida no devolvio ninguna URL de imagen");
        onChange(insertMarkdownBlock(valueRef.current, markdownImage(file.name, url), caretRef.current));
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "No se pudo insertar la imagen");
      } finally {
        setUploading(false);
      }
    },
    [onChange, onUploadImage],
  );

  return (
    <div
      className="grid gap-2"
      onKeyUp={trackCaret}
      onMouseUp={trackCaret}
      onInput={trackCaret}
      data-testid={testId}
      data-coord-id={coordId}
      data-observe="markdown-editor"
    >
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={pickImage} disabled={!onUploadImage || uploading} data-testid={`${testId}-image-btn`}>
          {uploading ? "Subiendo imagen…" : "Insertar imagen (CDN)"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => void handleFile(event)}
          data-testid={`${testId}-image-input`}
        />
      </div>
      {error ? (
        <InlineAlert kind="error" title="Imagen" message={error} className="text-sm" testId={`${testId}-image-error`} />
      ) : null}
      {MD ? (
        <div data-color-mode="light" data-testid={`${testId}-surface`}>
          <MD
            value={value}
            height={height}
            preview="edit"
            textareaProps={{ placeholder, "data-testid": `${testId}-textarea` }}
            onChange={(next?: string) => onChange(next ?? "")}
          />
        </div>
      ) : (
        <textarea
          className="bo-input min-h-[240px] w-full font-mono text-sm"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.currentTarget.value)}
          data-testid={`${testId}-fallback-textarea`}
        />
      )}
    </div>
  );
}
