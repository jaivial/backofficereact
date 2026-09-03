import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Eye } from "lucide-react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { useToasts } from "../../../../../ui/feedback/useToasts";
import { Tabs, type TabItem } from "../../../../../ui/nav/Tabs";
import { PageToolbar } from "../../../../../ui/shell/PageToolbar";
import type { LegalPageSlug } from "../../../../../api/types";
import { BlockNoteEditor, type BlockNoteDoc, type BlockNoteEditorHandle } from "./BlockNoteEditor";
import { useLegalPage } from "./legalPagesApi";

type EditorTab = "editor" | "preview";

const BACK_HREF = "/app/config?content=legal-pages";

function parseInitialDoc(contentJson: string): BlockNoteDoc | undefined {
  const raw = contentJson?.trim();
  if (!raw || raw === "[]") return undefined;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as BlockNoteDoc) : undefined;
  } catch {
    return undefined;
  }
}

export function LegalPageEditor({ slug }: { slug: LegalPageSlug }) {
  const { page, loading, error, saving, load, save } = useLegalPage(slug);
  const { pushToast } = useToasts();

  const [activeTab, setActiveTab] = useState<EditorTab>("editor");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const editorRef = useRef<BlockNoteEditorHandle | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Seed the preview from the stored HTML until the editor produces its own.
  useEffect(() => {
    if (page) setPreviewHtml(page.contentHtml);
  }, [page]);

  const tabs = useMemo<TabItem[]>(
    () => [
      { id: "editor", label: "Editor", href: "#editor", icon: <Pencil className="bo-ico" /> },
      { id: "preview", label: "Vista previa", href: "#preview", icon: <Eye className="bo-ico" /> },
    ],
    [],
  );

  const initialDoc = useMemo(() => (page ? parseInitialDoc(page.contentJson) : undefined), [page]);

  const onEditorReady = useCallback((handle: BlockNoteEditorHandle) => {
    editorRef.current = handle;
  }, []);

  const refreshPreview = useCallback(() => {
    if (editorRef.current) setPreviewHtml(editorRef.current.getHTML());
  }, []);

  // Full-page navigation back to the cards list. A plain client-side link makes
  // vike tear down the BlockNote editor mid-transition, which throws on the SSR
  // build (error boundary flashes before vike recovers with a reload). Matching
  // the comida detail back-button convention (window.location.assign) avoids it.
  const onBack = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.assign(BACK_HREF);
  }, []);

  const onNavigateTab = useCallback(
    (_href: string, id: string) => {
      const next = id as EditorTab;
      if (next === "preview") refreshPreview();
      setActiveTab(next);
    },
    [refreshPreview],
  );

  const onSave = useCallback(async () => {
    if (!page || !editorRef.current) return;
    const doc = editorRef.current.getDocument();
    const html = editorRef.current.getHTML();
    const ok = await save({
      title: page.title,
      contentJson: JSON.stringify(doc),
      contentHtml: html,
    });
    if (ok) {
      setPreviewHtml(html);
      pushToast({ kind: "success", title: "Guardado", message: "Página legal guardada" });
    } else {
      pushToast({ kind: "error", title: "No se pudo guardar" });
    }
  }, [page, save, pushToast]);

  if (loading) {
    return <InlineAlert kind="info" title="Cargando" message="Preparando la página legal..." />;
  }
  if (error) {
    return <InlineAlert kind="error" title="Error" message={error} />;
  }
  if (!page) {
    return <InlineAlert kind="error" title="No encontrada" message="La página legal no existe." />;
  }

  return (
    <section aria-label={`Editar ${page.title}`} data-testid="legal-page-editor">
      <style>{`
        .bo-main:has([data-testid="legal-page-editor"]) { padding-inline: 0px; }
        [data-slot="legal-page-editor-header"],
        [data-slot="legal-page-editor-toolbar"] { padding-inline: 1rem; }
        [data-testid="legal-page-editor"] [aria-autocomplete] { padding-inline: 1.5rem; border-radius: 0px; }
        [data-slot="legal-page-editor-previewPane"] { padding-inline: 1.5rem; border-radius: 0px; }
        [data-slot="legal-page-editor-previewPane"] .bo-cardBody { padding-inline: 0; }
      `}</style>
      <div className="bo-stack" data-slot="legal-page-editor-header">
        <h1 className="bo-pageTitle" data-slot="legal-page-editor-title">{page.title}</h1>
      </div>

      <Tabs
        tabs={tabs}
        activeId={activeTab}
        ariaLabel="Modo de edición de la página legal"
        className="mx-auto mb-6"
        mode="button"
        onNavigate={onNavigateTab}
        layoutId="boLegalPageTabIndicator"
      />

      <PageToolbar
        left={
          <a href={BACK_HREF} onClick={onBack} className="bo-btn bo-btn--ghost" data-testid="legal-page-editor-back">
            Volver
          </a>
        }
        right={
          <button
            type="button"
            className="bo-btn bo-btn--primary"
            onClick={() => void onSave()}
            disabled={saving}
            data-testid="legal-page-editor-save"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        }
        data-slot="legal-page-editor-toolbar"
      />

      <div style={{ display: activeTab === "editor" ? "block" : "none" }} data-slot="legal-page-editor-editorPane">
        <BlockNoteEditor initial={initialDoc} initialHtml={page.contentHtml} onReady={onEditorReady} onChange={refreshPreview} />
      </div>

      {activeTab === "preview" ? (
        <div className="bo-card" data-slot="legal-page-editor-previewPane">
          <div data-slot="legalPageEditor-cardBody" className="bo-cardBody">
            <div
              className="wrapperavisolegal"
              data-testid="legal-page-editor-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
