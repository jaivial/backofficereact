import React, { useEffect, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

// BlockNote's document is a deeply-generic block tree. We persist it as a JSON
// string, so at this boundary we treat the block array opaquely.
export type BlockNoteDoc = unknown[];

export type BlockNoteEditorHandle = {
  getDocument: () => BlockNoteDoc;
  getHTML: () => string;
};

// Inner component actually mounts BlockNote. Only rendered on the client (after
// the parent flips `mounted`), because BlockNote depends on browser APIs and
// cannot be server-side rendered.
function BlockNoteEditorClient({
  initial,
  initialHtml,
  onReady,
  onChange,
}: {
  initial?: BlockNoteDoc;
  initialHtml?: string;
  onReady: (handle: BlockNoteEditorHandle) => void;
  onChange?: () => void;
}) {
  const editor = useCreateBlockNote({
    initialContent: initial && initial.length ? (initial as never) : undefined,
  });

  // When there is no stored block tree but there is stored HTML (e.g. a page
  // seeded from the legacy static markup), hydrate the editor from the HTML so
  // it is editable instead of blank.
  useEffect(() => {
    if (initial && initial.length) return;
    const html = initialHtml?.trim();
    if (!html) return;
    const blocks = editor.tryParseHTMLToBlocks(html);
    if (blocks.length) {
      editor.replaceBlocks(editor.document, blocks);
    }
  }, [editor, initial, initialHtml]);

  useEffect(() => {
    onReady({
      getDocument: () => editor.document as BlockNoteDoc,
      getHTML: () => editor.blocksToHTMLLossy(editor.document),
    });
  }, [editor, onReady]);

  return (
    <div className="bo-legalPageEditor" data-slot="legal-page-blocknote">
      <BlockNoteView editor={editor} onChange={() => onChange?.()} />
    </div>
  );
}

export function BlockNoteEditor({
  initial,
  initialHtml,
  onReady,
  onChange,
}: {
  initial?: BlockNoteDoc;
  initialHtml?: string;
  onReady: (handle: BlockNoteEditorHandle) => void;
  onChange?: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="bo-legalPageEditor" data-slot="legal-page-blocknote-loading">
        <p className="bo-mutedText">Cargando editor…</p>
      </div>
    );
  }

  return <BlockNoteEditorClient initial={initial} initialHtml={initialHtml} onReady={onReady} onChange={onChange} />;
}
