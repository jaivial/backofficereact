import React, { useCallback, useEffect, useRef, useState } from "react";
import type { RichTextEditorSurfaceProps } from "./RichTextEditorSurface";

/**
 * Campaign body editor. This module is the SSR-safe half: it never imports the
 * rich text engine at module scope, it pulls the Tiptap surface in with a
 * dynamic `import()` after mount, and meanwhile paints a plain markdown
 * textarea with the very same value/onChange contract. The persisted model stays
 * markdown: the surface converts HTML on every change so `body_markdown` keeps
 * being the single source of truth for the backend renderer.
 */

export type RichTextEditorProps = {
  /** Markdown value. Converted to HTML to seed the editor. */
  value: string;
  /** Receives markdown, never HTML, so callers keep storing markdown. */
  onChange: (markdown: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
  placeholder?: string;
  minHeight?: number;
  testId: string;
  /** Coordination id shared with the backend for cross-boundary tracing. */
  coordId?: string;
};

type SurfaceComponent = React.ComponentType<RichTextEditorSurfaceProps>;

/** Height of the toolbar row, shared with the loading fallback so nothing jumps on swap. */
const TOOLBAR_HEIGHT = 44;

export function RichTextEditor({ value, onChange, onUploadImage, placeholder, minHeight = 320, testId, coordId }: RichTextEditorProps) {
  const [Surface, setSurface] = useState<SurfaceComponent | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let alive = true;
    void import("./RichTextEditorSurface").then((mod) => {
      if (alive) setSurface(() => mod.default);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The fallback grows like the rich surface, so typing before the engine lands
  // does not move the box around.
  const grow = useCallback(() => {
    const node = fallbackRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.max(minHeight, node.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => {
    grow();
  }, [grow, value]);

  if (Surface) {
    return (
      <Surface
        value={value}
        onChange={onChange}
        onUploadImage={onUploadImage}
        placeholder={placeholder}
        minHeight={minHeight}
        testId={testId}
        coordId={coordId}
      />
    );
  }

  return (
    <div className="grid gap-2" data-testid={testId} data-coord-id={coordId} data-observe="rich-text-editor">
      <div
        className="overflow-hidden rounded-bo-md border border-bo-border bg-[rgba(255,255,255,0.02)]"
        data-testid={`${testId}-loading`}
      >
        <div
          className="flex items-center gap-2 border-b border-bo-border bg-[rgba(255,255,255,0.02)] p-1.5 text-xs text-bo-faint"
          style={{ minHeight: TOOLBAR_HEIGHT }}
          aria-hidden="true"
          data-testid={`${testId}-loading-bar`}
        >
          Cargando editor…
        </div>
        <textarea
          ref={fallbackRef}
          className="bo-editorFallback"
          style={{ minHeight, overflow: "hidden" }}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.currentTarget.value)}
          data-testid={`${testId}-fallback-textarea`}
        />
      </div>
    </div>
  );
}
