import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { CharacterCount, Placeholder, UndoRedo } from "@tiptap/extensions";
import Bold from "@tiptap/extension-bold";
import Blockquote from "@tiptap/extension-blockquote";
import Code from "@tiptap/extension-code";
import Document from "@tiptap/extension-document";
import Heading from "@tiptap/extension-heading";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import ImageExtension from "@tiptap/extension-image";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import { BulletList, ListItem } from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import {
  Bold as BoldIcon,
  Code as CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic as ItalicIcon,
  Link2,
  List as ListIcon,
  Minus,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import { InlineAlert } from "../feedback/InlineAlert";
import { Toggle, toggleVariants } from "../shadcn/toggle";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../shadcn/tooltip";
import { cn } from "../shadcn/utils";
import { IMAGE_WIDTH_MIN, htmlToMarkdown, markdownImages, markdownToHtml } from "../../lib/richText/markdownHtml";

/**
 * Client-only Tiptap surface of the campaign body editor. It is loaded with a
 * dynamic `import()` after mount (see `RichTextEditor.tsx`), so nothing in here
 * ever runs during SSR.
 *
 * The extension set is deliberately the intersection with what the backend
 * renderer understands (`internal/api/campaign_markdown.go`): bold, italic,
 * inline code, h1-h3, bullet list, quote, divider, link and image. Anything the
 * email cannot express is simply not offered, so no marker leaks as literal text.
 */

export type RichTextEditorSurfaceProps = {
  /** Markdown value. Converted to HTML to seed the document. */
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

/** Widest image the surface offers; the email itself never goes past 600px of content. */
const IMAGE_WIDTH_CAP = 560;

/** One-click widths of the "Ancho de imagen" strip, mirroring the email column widths. */
const IMAGE_WIDTH_PRESETS = [
  { id: "small", label: "Pequeno", width: 240 },
  { id: "medium", label: "Mediano", width: 360 },
  { id: "large", label: "Grande", width: 480 },
  { id: "full", label: "Ancho completo", width: IMAGE_WIDTH_CAP },
] as const;

/** The strip only accepts a plain integer, so the free input is clamped the same way. */
function clampImageWidth(width: number): number {
  return Math.min(IMAGE_WIDTH_CAP, Math.max(IMAGE_WIDTH_MIN, Math.round(width)));
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

/**
 * Image with the width attribute the markdown bridge needs. The stock extension
 * drops unknown attributes on parse, so `![alt](URL =W)` would silently lose its
 * width on the first round trip without this.
 */
const CampaignImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...(this.parent?.() ?? {}),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("width"),
        renderHTML: (attributes: Record<string, unknown>) => (attributes.width ? { width: attributes.width } : {}),
      },
    };
  },
});

/** Toolbar state before the editor exists; keeps the selector total instead of nullable. */
const EMPTY_STATE = {
  bold: false,
  italic: false,
  code: false,
  h1: false,
  h2: false,
  h3: false,
  list: false,
  quote: false,
  link: false,
  canUndo: false,
  canRedo: false,
  characters: 0,
  words: 0,
};

/** Position of the image node holding the caret, or -1 when the selection is text. */
function selectedImageIndex(editor: Editor): number {
  const selection = editor.state.selection as unknown as { node?: { type: { name: string } }; from: number };
  if (selection.node?.type.name !== "image") return -1;
  let index = -1;
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "image") return;
    index += 1;
    if (pos === selection.from) found = index;
  });
  return found;
}

type Tool = {
  id: string;
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
};

export default function RichTextEditorSurface({
  value,
  onChange,
  onUploadImage,
  placeholder,
  minHeight = 320,
  testId,
  coordId,
}: RichTextEditorSurfaceProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Markdown this surface itself emitted. Comparing against it tells an external
  // change (a loaded campaign) from the user's own typing, so the caret is never
  // reset while writing.
  const emittedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [activeImage, setActiveImage] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");

  const editor = useEditor(
    {
      // The module is imported after mount, so the first render always happens in
      // the browser and the document can be built immediately.
      immediatelyRender: true,
      extensions: [
        Document,
        Paragraph,
        Text,
        Bold,
        Italic,
        Code,
        Heading.configure({ levels: [1, 2, 3] }),
        BulletList,
        ListItem,
        Blockquote,
        HorizontalRule,
        CampaignImage,
        Link.configure({ openOnClick: false, autolink: false, linkOnPaste: true }),
        Placeholder.configure({ placeholder: placeholder ?? "" }),
        UndoRedo,
        CharacterCount,
      ],
      content: markdownToHtml(value),
      editorProps: {
        attributes: {
          id: `${testId}-content`,
          class: "bo-editorProse",
          "data-testid": `${testId}-content`,
          "data-observe": "rich-text-editor-content",
        },
      },
      onUpdate: ({ editor: instance }) => {
        const markdown = htmlToMarkdown(instance.getHTML());
        if (markdown === emittedRef.current) return;
        emittedRef.current = markdown;
        onChangeRef.current(markdown);
      },
    },
    [],
  );

  // Pushes external values in (edit mode hydration, programmatic resets).
  useEffect(() => {
    if (!editor || value === emittedRef.current) return;
    emittedRef.current = value;
    editor.commands.setContent(markdownToHtml(value), { emitUpdate: false });
  }, [editor, value]);

  // Clicking an image (or arrowing into it) makes it the target of the width strip.
  useEffect(() => {
    if (!editor) return;
    const sync = () => {
      const index = selectedImageIndex(editor);
      if (index >= 0) setActiveImage(index);
    };
    editor.on("selectionUpdate", sync);
    return () => {
      editor.off("selectionUpdate", sync);
    };
  }, [editor]);

  const state = useEditorState({
    editor,
    selector: ({ editor: instance }) => {
      if (!instance) return EMPTY_STATE;
      const storage = instance.storage as { characterCount?: { characters: () => number; words: () => number } };
      return {
        bold: instance.isActive("bold"),
        italic: instance.isActive("italic"),
        code: instance.isActive("code"),
        h1: instance.isActive("heading", { level: 1 }),
        h2: instance.isActive("heading", { level: 2 }),
        h3: instance.isActive("heading", { level: 3 }),
        list: instance.isActive("bulletList"),
        quote: instance.isActive("blockquote"),
        link: instance.isActive("link"),
        canUndo: instance.can().undo(),
        canRedo: instance.can().redo(),
        characters: storage.characterCount?.characters() ?? 0,
        words: storage.characterCount?.words() ?? 0,
      };
    },
  });

  const images = useMemo(() => markdownImages(value), [value]);
  const imageCount = images.length;
  const targetImage = imageCount ? Math.min(activeImage, imageCount - 1) : 0;
  const targetWidth = images[targetImage]?.width ?? null;

  /** Rewrites the width of one image node; `onUpdate` turns it back into markdown. */
  const applyImageWidth = useCallback(
    (width: number) => {
      if (!editor || !imageCount) return;
      let index = -1;
      let pos = -1;
      editor.state.doc.descendants((node, nodePos) => {
        if (node.type.name !== "image") return;
        index += 1;
        if (index === targetImage) {
          pos = nodePos;
          return false;
        }
      });
      const node = pos < 0 ? null : editor.state.doc.nodeAt(pos);
      if (!node) return;
      editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, width: clampImageWidth(width) }));
    },
    [editor, imageCount, targetImage],
  );

  /** Commits whatever the free numeric input holds, when it actually changed. */
  const commitWidthDraft = useCallback(
    (event: React.SyntheticEvent<HTMLInputElement>) => {
      const width = Number.parseInt(event.currentTarget.value, 10);
      if (Number.isFinite(width) && width !== targetWidth) applyImageWidth(width);
    },
    [applyImageWidth, targetWidth],
  );

  const pickImage = useCallback(() => fileRef.current?.click(), []);

  const handleFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !onUploadImage || !editor) return;
      setUploading(true);
      setError("");
      try {
        const url = await onUploadImage(file);
        if (!url) throw new Error("La subida no devolvio ninguna URL de imagen");
        const { width } = await measureImage(url, IMAGE_WIDTH_CAP);
        // Inserting through the editor keeps the change flowing back out as
        // markdown, so the body receives the image with its measured width.
        editor.chain().focus().insertContent({ type: "image", attrs: { src: url, alt: "", width } }).run();
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : "No se pudo insertar la imagen");
      } finally {
        setUploading(false);
      }
    },
    [editor, onUploadImage],
  );

  /** Opens the inline link form seeded with the selection and the current link. */
  const openLink = useCallback(() => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkText(empty ? "" : editor.state.doc.textBetween(from, to, " "));
    setLinkOpen(true);
  }, [editor]);

  /**
   * Applies the link as a text mark instead of pasted HTML, so a URL typed by the
   * operator can never inject markup into the body.
   */
  const applyLink = useCallback(() => {
    if (!editor) return;
    const href = linkUrl.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: linkText.trim() || href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      // Selection (or an existing link): retarget the mark instead of stacking
      // a second one, which is what the operator expects when editing.
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
  }, [editor, linkText, linkUrl]);

  const removeLink = useCallback(() => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }, [editor]);

  // Tool groups follow the order of the written sentence: marks, blocks,
  // structure, insertions, history. Separators are decorative, hence aria-hidden.
  const groups: { id: string; tools: Tool[] }[] = [
    {
      id: "marks",
      tools: [
        { id: "bold", label: "Negrita", shortcut: "Ctrl+B", icon: <BoldIcon size={15} aria-hidden="true" />, active: state?.bold, run: () => editor?.chain().focus().toggleBold().run() },
        { id: "italic", label: "Cursiva", shortcut: "Ctrl+I", icon: <ItalicIcon size={15} aria-hidden="true" />, active: state?.italic, run: () => editor?.chain().focus().toggleItalic().run() },
        { id: "code", label: "Codigo", shortcut: "Ctrl+E", icon: <CodeIcon size={15} aria-hidden="true" />, active: state?.code, run: () => editor?.chain().focus().toggleCode().run() },
      ],
    },
    {
      id: "blocks",
      tools: [
        { id: "h1", label: "Titulo 1", shortcut: "Ctrl+Alt+1", icon: <Heading1 size={15} aria-hidden="true" />, active: state?.h1, run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
        { id: "h2", label: "Titulo 2", shortcut: "Ctrl+Alt+2", icon: <Heading2 size={15} aria-hidden="true" />, active: state?.h2, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
        { id: "h3", label: "Titulo 3", shortcut: "Ctrl+Alt+3", icon: <Heading3 size={15} aria-hidden="true" />, active: state?.h3, run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
      ],
    },
    {
      id: "structure",
      tools: [
        { id: "ul", label: "Lista con vinetas", shortcut: "Ctrl+Shift+8", icon: <ListIcon size={15} aria-hidden="true" />, active: state?.list, run: () => editor?.chain().focus().toggleBulletList().run() },
        { id: "quote", label: "Cita", shortcut: "Ctrl+Shift+B", icon: <Quote size={15} aria-hidden="true" />, active: state?.quote, run: () => editor?.chain().focus().toggleBlockquote().run() },
      ],
    },
    {
      id: "insert",
      tools: [
        { id: "link", label: "Enlace", icon: <Link2 size={15} aria-hidden="true" />, active: state?.link, run: openLink },
        { id: "divider", label: "Separador", icon: <Minus size={15} aria-hidden="true" />, run: () => editor?.chain().focus().setHorizontalRule().run() },
      ],
    },
    {
      id: "history",
      tools: [
        { id: "undo", label: "Deshacer", shortcut: "Ctrl+Z", icon: <Undo2 size={15} aria-hidden="true" />, disabled: !state?.canUndo, run: () => editor?.chain().focus().undo().run() },
        { id: "redo", label: "Rehacer", shortcut: "Ctrl+Shift+Z", icon: <Redo2 size={15} aria-hidden="true" />, disabled: !state?.canRedo, run: () => editor?.chain().focus().redo().run() },
      ],
    },
  ];

  return (
    <div className="grid gap-2" data-testid={testId} data-coord-id={coordId} data-observe="rich-text-editor">
      <div
        className="overflow-hidden rounded-bo-md border border-bo-border bg-[rgba(255,255,255,0.02)] transition-[border-color,box-shadow] duration-150 focus-within:border-[rgba(185,168,255,0.38)] focus-within:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
        data-testid={`${testId}-surface`}
        data-observe="rich-text-editor-surface"
        data-coord-id={coordId ? `${coordId}-surface` : undefined}
      >
        <TooltipProvider delayDuration={350} skipDelayDuration={200}>
          <div
            className="flex flex-wrap items-center gap-1 border-b border-bo-border bg-[rgba(255,255,255,0.02)] p-1.5"
            role="toolbar"
            aria-label="Formato del mensaje"
            aria-controls={`${testId}-content`}
            data-testid={`${testId}-toolbar`}
            data-observe="rich-text-editor-toolbar"
            data-coord-id={coordId ? `${coordId}-toolbar` : undefined}
          >
            {groups.map((group, groupIndex) => (
              <React.Fragment key={group.id}>
                {groupIndex > 0 ? <span className="mx-0.5 h-5 w-px bg-bo-border" aria-hidden="true" data-testid={`${testId}-group-sep-${group.id}`} /> : null}
                {group.tools.map((tool) => (
                  <Tooltip key={tool.id}>
                    <TooltipTrigger asChild>
                      <Toggle
                        size="icon"
                        pressed={tool.active}
                        disabled={tool.disabled}
                        aria-label={tool.label}
                        onClick={tool.run}
                        data-testid={`${testId}-tool-${tool.id}`}
                        data-observe={`rich-text-editor-tool-${tool.id}`}
                      >
                        {tool.icon}
                      </Toggle>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={6} data-testid={`${testId}-tooltip-${tool.id}`}>
                      <span className="font-medium">{tool.label}</span>
                      {tool.shortcut ? <span className="ml-2 opacity-70" data-testid={`${testId}-shortcut-${tool.id}`}>{tool.shortcut}</span> : null}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </React.Fragment>
            ))}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(toggleVariants({ size: "label" }), "ml-0.5")}
                  disabled={uploading}
                  aria-label="Insertar imagen (CDN)"
                  onClick={pickImage}
                  data-testid={`${testId}-image-btn`}
                  data-observe="rich-text-editor-image-btn"
                >
                  <ImageIcon size={15} aria-hidden="true" />
                  <span className="hidden sm:inline">{uploading ? "Subiendo imagen…" : "Insertar imagen (CDN)"}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6} data-testid={`${testId}-tooltip-image`}>
                <span className="font-medium">Sube una imagen y la inserta donde esta el cursor</span>
              </TooltipContent>
            </Tooltip>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => void handleFile(event)}
              data-testid={`${testId}-image-input`}
            />
          </div>

          {linkOpen ? (
            <div
              className="grid gap-2 border-b border-bo-border bg-[rgba(185,168,255,0.06)] p-2 sm:grid-cols-[1fr_1fr_auto]"
              data-testid={`${testId}-link-panel`}
              data-observe="rich-text-editor-link-panel"
              data-coord-id={coordId ? `${coordId}-link` : undefined}
            >
              <label className="grid gap-1" data-testid={`${testId}-link-url-field`}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bo-muted">Direccion</span>
                <input
                  className="bo-input bo-input--sm w-full"
                  type="url"
                  inputMode="url"
                  placeholder="https://…"
                  value={linkUrl}
                  autoFocus
                  onChange={(event) => setLinkUrl(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyLink();
                    if (event.key === "Escape") setLinkOpen(false);
                  }}
                  data-testid={`${testId}-link-url-input`}
                  data-observe="rich-text-editor-link-url"
                />
              </label>
              <label className="grid gap-1" data-testid={`${testId}-link-text-field`}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bo-muted">Texto visible</span>
                <input
                  className="bo-input bo-input--sm w-full"
                  placeholder="Se usa la direccion si lo dejas vacio"
                  value={linkText}
                  onChange={(event) => setLinkText(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyLink();
                    if (event.key === "Escape") setLinkOpen(false);
                  }}
                  data-testid={`${testId}-link-text-input`}
                  data-observe="rich-text-editor-link-text"
                />
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  className={cn(toggleVariants({ size: "label" }), "border-[rgba(185,168,255,0.3)] bg-[rgba(185,168,255,0.16)] text-bo-text")}
                  onClick={applyLink}
                  data-testid={`${testId}-link-apply-btn`}
                >
                  Aplicar
                </button>
                {state?.link ? (
                  <button
                    type="button"
                    className={cn(toggleVariants({ size: "label" }))}
                    onClick={removeLink}
                    data-testid={`${testId}-link-remove-btn`}
                  >
                    Quitar
                  </button>
                ) : null}
                <button
                  type="button"
                  className={cn(toggleVariants({ size: "label" }))}
                  onClick={() => setLinkOpen(false)}
                  data-testid={`${testId}-link-cancel-btn`}
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : null}
        </TooltipProvider>

        {imageCount ? (
          <div
            className="flex flex-wrap items-center gap-2 border-b border-bo-border bg-[rgba(255,255,255,0.02)] px-2 py-1.5"
            data-testid={`${testId}-img-width-strip`}
            data-observe="rich-text-editor-image-width"
            data-coord-id={coordId ? `${coordId}-image-width` : undefined}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-bo-muted" data-testid={`${testId}-img-width-label`} data-observe="rich-text-editor-image-width-label">
              Ancho de imagen
            </span>
            {imageCount > 1 ? (
              <span className="text-[11px] text-bo-faint" data-testid={`${testId}-img-width-target`} data-observe="rich-text-editor-image-width-target">
                Imagen {targetImage + 1}/{imageCount}
              </span>
            ) : null}
            {IMAGE_WIDTH_PRESETS.map((preset) => (
              <Toggle
                key={preset.id}
                size="label-sm"
                pressed={targetWidth === preset.width}
                title={`${preset.label} (${preset.width}px)`}
                aria-label={`Ancho de imagen ${preset.label}, ${preset.width} pixeles`}
                onClick={() => applyImageWidth(preset.width)}
                data-testid={`${testId}-img-width-${preset.id}`}
                data-observe={`rich-text-editor-image-width-${preset.id}`}
              >
                {preset.label} {preset.width}
              </Toggle>
            ))}
            <label className="flex items-center gap-1 text-[11px] text-bo-muted" data-testid={`${testId}-img-width-field`} data-observe="rich-text-editor-image-width-field">
              <input
                key={`${targetImage}-${targetWidth ?? 0}`}
                type="number"
                className="bo-input bo-input--sm w-20"
                min={IMAGE_WIDTH_MIN}
                max={IMAGE_WIDTH_CAP}
                step={10}
                defaultValue={targetWidth ?? IMAGE_WIDTH_CAP}
                aria-label="Ancho de imagen en pixeles"
                onBlur={commitWidthDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commitWidthDraft(event);
                }}
                data-testid={`${testId}-img-width-input`}
                data-observe="rich-text-editor-image-width-input"
                data-coord-id={coordId ? `${coordId}-image-width-input` : undefined}
              />
              px
            </label>
          </div>
        ) : null}

        <EditorContent
          editor={editor}
          className="bo-editorBody"
          style={{ minHeight }}
          data-testid={`${testId}-body`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-bo-faint" data-testid={`${testId}-footer`}>
        <span data-testid={`${testId}-hint`}>
          Solo lo que el email puede mostrar: negrita, cursiva, titulos, listas, citas, enlaces e imagenes.
        </span>
        <span data-testid={`${testId}-count`} data-observe="rich-text-editor-count">
          {state?.characters ?? 0} caracteres &middot; {state?.words ?? 0} palabras
        </span>
      </div>

      {error ? <InlineAlert kind="error" title="Imagen" message={error} className="text-sm" testId={`${testId}-image-error`} /> : null}
    </div>
  );
}
