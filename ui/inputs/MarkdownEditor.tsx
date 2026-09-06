import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../actions/Button";

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

export function MarkdownEditor({ value, onChange, onUploadImage, height = 420, placeholder, testId, coordId }: MarkdownEditorProps) {
  const [MD, setMD] = useState<MDComponent | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    void import("@uiw/react-md-editor").then((mod) => {
      if (alive) setMD(() => mod.default as unknown as MDComponent);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pickImage = useCallback(() => fileRef.current?.click(), []);

  const handleFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !onUploadImage) return;
      setUploading(true);
      try {
        const url = await onUploadImage(file);
        if (url) onChange(`${value}${value.endsWith("\n") || value === "" ? "" : "\n"}\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n`);
      } finally {
        setUploading(false);
      }
    },
    [onChange, onUploadImage, value],
  );

  return (
    <div className="grid gap-2" data-testid={testId} data-coord-id={coordId} data-observe="markdown-editor">
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
