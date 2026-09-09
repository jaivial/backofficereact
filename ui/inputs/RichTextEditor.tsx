import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EnrichedTextInputInstance, EnrichedTextInputProps } from "react-native-enriched-html";
import { Bold, Code, Heading1, Heading2, Heading3, Image as ImageIcon, Italic, Link2, List, Minus, Quote } from "lucide-react";
import { Button } from "../actions/Button";
import { InlineAlert } from "../feedback/InlineAlert";
import { htmlToMarkdown, markdownToHtml } from "../../lib/richText/markdownHtml";

// Rich text editor built on `react-native-enriched-html` (TipTap on web).
// It is imperative/uncontrolled by design: the value is pushed with
// `ref.setValue()` and read back through `onChangeHtml`. The library is
// client-only (asserts a browser environment, imports its own CSS), so it is
// pulled in with a dynamic `import()` after mount to keep SSR alive.
//
// The persisted model stays markdown: HTML is converted on every change so
// `body_markdown` remains the single source of truth for the backend renderer.

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

type EnrichedComponent = React.ComponentType<EnrichedTextInputProps>;

/** Inner padding of the editing surface, shared with the loading fallback so the swap is seamless. */
const SURFACE_PADDING = 12;

/**
 * Auto-grow contract of the editor surface: every layer is `height: auto`, so the
 * content decides the height and `minHeight` is only a floor. Nothing scrolls
 * internally, the page scrolls instead. `border-box` keeps the floor comparable
 * between the rich editor and its fallback, whatever the padding is.
 */
type AutoGrowStyle = { height: "auto"; minHeight: number; boxSizing: "border-box" };

function autoGrowStyle(minHeight: number): AutoGrowStyle {
  return { height: "auto", minHeight, boxSizing: "border-box" };
}

/** Natural size of an uploaded image, capped to the email content width. */
async function measureImage(url: string, maxWidth: number): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = Math.min(img.naturalWidth || maxWidth, maxWidth);
      const ratio = img.naturalWidth ? width / img.naturalWidth : 1;
      resolve({ width, height: Math.round((img.naturalHeight || width) * ratio) });
    };
    img.onerror = () => resolve({ width: maxWidth, height: maxWidth });
    img.src = url;
  });
}

export function RichTextEditor({ value, onChange, onUploadImage, placeholder, minHeight = 320, testId, coordId }: RichTextEditorProps) {
  const [Enriched, setEnriched] = useState<EnrichedComponent | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef<EnrichedTextInputInstance | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null);
  // Markdown this editor itself emitted. Comparing against it tells an external
  // change (a loaded campaign) from the user's own typing, so the caret is
  // never reset while writing.
  const emittedRef = useRef(value);
  const seededRef = useRef(false);

  useEffect(() => {
    let alive = true;
    void import("react-native-enriched-html").then((mod) => {
      if (alive) setEnriched(() => mod.EnrichedTextInput as unknown as EnrichedComponent);
    });
    return () => {
      alive = false;
    };
  }, []);

  // The editor is uncontrolled: it is seeded once with the value present when
  // the library finishes loading, and updated afterwards through `setValue`.
  const initialMarkdownRef = useRef(value);
  initialMarkdownRef.current = seededRef.current ? initialMarkdownRef.current : value;

  // The fallback textarea grows exactly like the rich surface, so the box does
  // not jump when the library finishes loading and TipTap takes over.
  // Measured after mount only: nothing here runs during server render.
  useEffect(() => {
    const node = fallbackRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.max(minHeight, node.scrollHeight)}px`;
  }, [minHeight, value]);

  // Pushes external values in (edit mode hydration, programmatic resets).
  useEffect(() => {
    if (!Enriched || !editorRef.current) return;
    if (!seededRef.current) {
      seededRef.current = true;
      emittedRef.current = value;
      return;
    }
    if (value === emittedRef.current) return;
    emittedRef.current = value;
    editorRef.current.setValue(markdownToHtml(value));
  }, [Enriched, value]);

  const handleHtml = useCallback(
    (html: string) => {
      const markdown = htmlToMarkdown(html);
      if (markdown === emittedRef.current) return;
      emittedRef.current = markdown;
      onChange(markdown);
    },
    [onChange],
  );

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
        const { width, height } = await measureImage(url, 560);
        // Inserting through the editor keeps the change flowing back out via
        // `onChangeHtml`, so the markdown body always receives the image.
        editorRef.current?.setImage(url, width, height);
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "No se pudo insertar la imagen");
      } finally {
        setUploading(false);
      }
    },
    [onUploadImage],
  );

  const addLink = useCallback(() => {
    const url = window.prompt("URL del enlace");
    if (!url) return;
    const text = window.prompt("Texto del enlace", url) || url;
    // No selection API for "insert at caret": append the markdown link so the
    // body always ends up with it, even with nothing selected.
    const next = `${emittedRef.current}${emittedRef.current ? "\n\n" : ""}[${text}](${url})`;
    emittedRef.current = next;
    editorRef.current?.setValue(markdownToHtml(next));
    onChange(next);
  }, [onChange]);

  // Only the formats the campaign email renderer can express are offered, so
  // what the operator applies is exactly what the recipient receives.
  const tools = useMemo(
    () =>
      [
        { id: "bold", label: "Negrita", icon: <Bold size={15} aria-hidden="true" />, run: (e: EnrichedTextInputInstance) => e.toggleBold() },
        { id: "italic", label: "Cursiva", icon: <Italic size={15} aria-hidden="true" />, run: (e: EnrichedTextInputInstance) => e.toggleItalic() },
        { id: "code", label: "Codigo", icon: <Code size={15} aria-hidden="true" />, run: (e: EnrichedTextInputInstance) => e.toggleInlineCode() },
        { id: "h1", label: "Titulo 1", icon: <Heading1 size={15} aria-hidden="true" />, run: (e: EnrichedTextInputInstance) => e.toggleH1() },
        { id: "h2", label: "Titulo 2", icon: <Heading2 size={15} aria-hidden="true" />, run: (e: EnrichedTextInputInstance) => e.toggleH2() },
        { id: "h3", label: "Titulo 3", icon: <Heading3 size={15} aria-hidden="true" />, run: (e: EnrichedTextInputInstance) => e.toggleH3() },
        { id: "ul", label: "Lista", icon: <List size={15} aria-hidden="true" />, run: (e: EnrichedTextInputInstance) => e.toggleUnorderedList() },
        { id: "quote", label: "Cita", icon: <Quote size={15} aria-hidden="true" />, run: (e: EnrichedTextInputInstance) => e.toggleBlockQuote() },
      ] as const,
    [],
  );

  const runTool = useCallback((run: (editor: EnrichedTextInputInstance) => void) => {
    if (editorRef.current) run(editorRef.current);
  }, []);

  const addDivider = useCallback(() => {
    const next = `${emittedRef.current}${emittedRef.current ? "\n\n" : ""}---`;
    emittedRef.current = next;
    editorRef.current?.setValue(markdownToHtml(next));
    onChange(next);
  }, [onChange]);

  return (
    <div className="grid gap-2" style={{ height: "auto" }} data-testid={testId} data-coord-id={coordId} data-observe="rich-text-editor">
      <div className="flex flex-wrap items-center gap-1" data-testid={`${testId}-toolbar`}>
        {tools.map((tool) => (
          <Button
            key={tool.id}
            variant="ghost"
            size="sm"
            title={tool.label}
            aria-label={tool.label}
            disabled={!Enriched}
            onClick={() => runTool(tool.run)}
            data-testid={`${testId}-tool-${tool.id}`}
          >
            {tool.icon}
          </Button>
        ))}
        <Button variant="ghost" size="sm" title="Enlace" aria-label="Enlace" disabled={!Enriched} onClick={addLink} data-testid={`${testId}-tool-link`}>
          <Link2 size={15} aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="sm" title="Separador" aria-label="Separador" disabled={!Enriched} onClick={addDivider} data-testid={`${testId}-tool-divider`}>
          <Minus size={15} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={pickImage}
          disabled={!onUploadImage || uploading || !Enriched}
          data-testid={`${testId}-image-btn`}
        >
          <ImageIcon size={15} aria-hidden="true" /> {uploading ? "Subiendo imagen…" : "Insertar imagen (CDN)"}
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
      {error ? <InlineAlert kind="error" title="Imagen" message={error} className="text-sm" testId={`${testId}-image-error`} /> : null}
      {Enriched ? (
        <div
          className="bo-input p-0"
          style={autoGrowStyle(minHeight)}
          data-testid={`${testId}-surface`}
          data-observe="rich-text-editor-surface"
          data-coord-id={coordId ? `${coordId}-surface` : undefined}
        >
          <Enriched
            ref={editorRef}
            defaultValue={markdownToHtml(initialMarkdownRef.current)}
            placeholder={placeholder}
            scrollEnabled={false}
            style={{ ...autoGrowStyle(minHeight), padding: SURFACE_PADDING }}
            onChangeHtml={(event) => handleHtml(event.nativeEvent.value)}
          />
        </div>
      ) : (
        <textarea
          className="bo-input w-full font-mono text-sm"
          style={{ ...autoGrowStyle(minHeight), padding: SURFACE_PADDING, overflow: "hidden" }}
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            emittedRef.current = event.currentTarget.value;
            onChange(event.currentTarget.value);
          }}
          data-testid={`${testId}-fallback-textarea`}
        />
      )}
    </div>
  );
}
