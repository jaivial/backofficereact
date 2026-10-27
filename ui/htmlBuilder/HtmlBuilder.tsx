import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Code2, Eye, Layers, Loader2, PanelLeft, PenTool, Plus, Redo2, SlidersHorizontal, Sparkles, Undo2 } from "lucide-react";
import { cn } from "../shadcn/utils";
import { Select } from "../inputs/Select";
import type { BlockContext, BlockDef } from "./blocks";
import {
  duplicateElement, elementHtml, elementLabel, findById, insertSnippet, moveElement, moveElementTo, normalizeDesign, parentId,
  parseFragment, removeElement, stripIds, updateElement, type InsertPosition,
} from "./document";
import { fetchDesignCss } from "./css";
import { BuilderCanvas, type BuilderDevice, type CanvasDrop } from "./BuilderCanvas";
import { BlockPalette, LayersPanel, type BlockIcon } from "./BuilderPanels";
import { BuilderInspector, type LinkPreset } from "./BuilderInspector";
import { BuilderChat, type BuilderAI, type ChatLayout } from "./BuilderChat";
import { DeviceSwitch, PreviewFrame } from "./PreviewFrame";
import { BuilderTestIdContext } from "./testIds";

/*
 * Campaign HTML builder (coordination id campaign_html_builder_v1): a
 * Figma-like editor for the campaign email. Left: components and layers.
 * Centre: the design on a canvas at desktop, tablet or phone width. Right: the
 * properties of the selection and the AI assistant, which edits the same
 * design live. The design is Tailwind HTML; what is stored is that HTML (ids
 * stripped) and the email is compiled from it on save.
 */

/**
 * What makes the builder a campaign-email or a web-ad editor
 * (html_builder_shared_v1): its blocks, how "Vista previa" compiles the design,
 * editing hints, link shortcuts, extra inspector controls and its AI backend.
 */
export type BuilderProfile = {
  /** Prefix of every data-testid ("email-builder", "ad-builder"). */
  testIdPrefix: string;
  /** data-testid of the root panel. */
  rootTestId: string;
  blocks: BlockDef[];
  blockIcons?: Record<string, BlockIcon>;
  /** The sendable / publishable document "Vista previa" shows. */
  preview: (design: string, signal: AbortSignal) => Promise<string>;
  previewWaitLabel: string;
  previewErrorLabel: string;
  canvasCss?: string;
  linkPresets?: LinkPreset[];
  extraVisibility?: (el: Element, update: (fn: (node: HTMLElement) => void) => void) => React.ReactNode;
  ai: BuilderAI;
};

type Props = {
  /** Stored design (no editing ids); empty while the seed is not ready. */
  value: string;
  onChange: (html: string) => void;
  context: BlockContext;
  coordId: string;
  onUploadImage?: (file: File) => Promise<string>;
  profile: BuilderProfile;
};

type Mode = "design" | "preview" | "code";
type LeftTab = "blocks" | "layers" | "style";
type ChatState = "closed" | ChatLayout;

const HISTORY_LIMIT = 80;
const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
};

function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return match;
}

function ToolButton({ title, onClick, disabled, active, children, testId, className }: { title: string; onClick: () => void; disabled?: boolean; active?: boolean; children: React.ReactNode; testId: string; className?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border-0 px-2 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-35",
        active ? "bg-[#7c5cff]/20 text-[#cfc4ff]" : "bg-transparent text-bo-muted hover:bg-bo-surface-2 hover:text-bo-text",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

export function HtmlBuilder({ value, onChange, context, coordId, onUploadImage, profile }: Props) {
  const tp = profile.testIdPrefix;
  const [design, setDesign] = useState("");
  const designRef = useRef("");
  const emitted = useRef<string | null>(null);
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  // Bumped on every history move so the undo/redo buttons re-render.
  const [, setHistoryTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [device, setDevice] = useState<BuilderDevice>("desktop");
  const [zoom, setZoom] = useState<"fit" | number>("fit");
  const [mode, setMode] = useState<Mode>("design");
  const [leftOpen, setLeftOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTab>("blocks");
  const [css, setCss] = useState("");
  const [code, setCode] = useState("");
  const lg = useMinWidth(1024);
  const xl = useMinWidth(1280);
  // The inspector gets its own column only on wide screens with the chat
  // folded; otherwise it is the "Estilo" tab, so the canvas keeps its room.
  const [chat, setChat] = useState<ChatState>("closed");
  const inspectorRight = xl && chat === "closed";

  // On a phone the desktop frame would be a thumbnail: start on the phone frame.
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) setDevice("mobile");
  }, []);

  // External value (first load, seed, saved campaign) -> builder state.
  useEffect(() => {
    if (!value || value === emitted.current) return;
    const next = normalizeDesign(value);
    designRef.current = next;
    setDesign(next);
    emitted.current = value;
    past.current = [];
    future.current = [];
    setHistoryTick((t) => t + 1);
  }, [value]);

  const commit = useCallback(
    (next: string, select?: string | null) => {
      const prev = designRef.current;
      if (next === prev) return;
      past.current = [...past.current.slice(-HISTORY_LIMIT + 1), prev];
      future.current = [];
      designRef.current = next;
      setDesign(next);
      setHistoryTick((t) => t + 1);
      const clean = stripIds(next);
      emitted.current = clean;
      onChange(clean);
      if (select !== undefined) setSelectedId(select);
    },
    [onChange],
  );

  const travel = useCallback(
    (from: React.MutableRefObject<string[]>, to: React.MutableRefObject<string[]>) => {
      const target = from.current[from.current.length - 1];
      if (target === undefined) return;
      from.current = from.current.slice(0, -1);
      to.current = [...to.current, designRef.current];
      designRef.current = target;
      setDesign(target);
      setHistoryTick((t) => t + 1);
      const clean = stripIds(target);
      emitted.current = clean;
      onChange(clean);
    },
    [onChange],
  );
  const undo = useCallback(() => travel(past, future), [travel]);
  const redo = useCallback(() => travel(future, past), [travel]);

  // Tailwind CSS of the design, compiled by the backoffice server (debounced).
  useEffect(() => {
    if (!design) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchDesignCss(stripIds(design), coordId, controller.signal)
        .then((next) => {
          setCss(next);
        })
        // A failed compile keeps the last CSS; saving reports the error.
        .catch(() => undefined);
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [design, coordId]);

  // Empty until the client mounts: the DOM model never runs during SSR (no DOMParser there).
  const selected = useMemo(() => (design && selectedId ? findById(parseFragment(design), selectedId) : null), [design, selectedId]);
  // What the AI reads: the design and the selection, without editing ids.
  const aiDesign = useMemo(() => (chat === "closed" || !design ? "" : stripIds(design)), [chat, design]);
  const aiSelection = useMemo(() => (chat === "closed" || !selectedId ? "" : elementHtml(design, selectedId)), [chat, design, selectedId]);
  const selectedLabel = selected ? elementLabel(selected) : "";
  useEffect(() => {
    if (selectedId && design && !selected) setSelectedId(null);
  }, [design, selected, selectedId]);

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      if (id && !inspectorRight) setLeftTab("style");
    },
    [inspectorRight],
  );

  const addBlock = useCallback(
    (kind: string, targetId: string | null = selectedId, position: InsertPosition | "block-after" = "block-after") => {
      const block = profile.blocks.find((b) => b.kind === kind);
      if (!block) return;
      const res = insertSnippet(designRef.current, block.html(context), targetId, position);
      commit(res.html, res.id);
    },
    [commit, context, profile.blocks, selectedId],
  );

  const onDrop = useCallback(
    (drop: CanvasDrop) => {
      if (drop.block) addBlock(drop.block, drop.targetId, drop.position);
      else if (drop.moveId) commit(moveElementTo(designRef.current, drop.moveId, drop.targetId, drop.position), drop.moveId);
    },
    [addBlock, commit],
  );

  const actions = useMemo(
    () => ({
      update: (id: string, fn: (el: HTMLElement) => void) => commit(updateElement(designRef.current, id, fn)),
      selectParent: () => setSelectedId((id) => parentId(designRef.current, id)),
      move: (direction: -1 | 1) => selectedId && commit(moveElement(designRef.current, selectedId, direction)),
      duplicate: () => {
        if (!selectedId) return;
        const res = duplicateElement(designRef.current, selectedId);
        commit(res.html, res.id);
      },
      remove: () => selectedId && commit(removeElement(designRef.current, selectedId), null),
      uploadImage: onUploadImage,
    }),
    [commit, onUploadImage, selectedId],
  );

  const onKey = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        redo();
      } else if (mod && key === "d" && selectedId) {
        e.preventDefault();
        actions.duplicate();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        actions.remove();
      } else if (e.key === "Escape") {
        actions.selectParent();
      }
    },
    [actions, redo, selectedId, undo],
  );

  // "Vista previa": the exact email the server compiles for SMTP (campaign_tools_v1).
  const [preview, setPreview] = useState<{ html: string; error: string }>({ html: "", error: "" });
  useEffect(() => {
    if (mode !== "preview" || !design) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      profile
        .preview(design, controller.signal)
        .then((html) => setPreview({ html, error: "" }))
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setPreview((prev) => ({ html: prev.html, error: err instanceof Error ? err.message : profile.previewErrorLabel }));
        });
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [design, mode, profile]);
  const previewHtml = mode === "preview" ? preview.html : "";

  useEffect(() => {
    if (mode === "code") setCode(stripIds(designRef.current));
  }, [mode]);

  const applyAI = useCallback((html: string) => {
    const previous = stripIds(designRef.current);
    commit(normalizeDesign(html), null);
    return previous;
  }, [commit]);
  const restore = useCallback((html: string) => commit(normalizeDesign(html), null), [commit]);

  if (!design) {
    return (
      <BuilderTestIdContext.Provider value={tp}>
      <div className="grid min-h-[420px] place-items-center rounded-bo-lg border border-bo-border bg-bo-surface-3 text-sm text-bo-muted" data-testid={`${tp}-loading`}>
        <span className="inline-flex items-center gap-2" data-testid={`${tp}-loading-label`}>
          <Loader2 size={16} className="animate-spin" aria-hidden="true" data-testid={`${tp}-loading-icon`} /> Preparando el editor…
        </span>
      </div>
      </BuilderTestIdContext.Provider>
    );
  }

  const inspector = (
    <BuilderInspector html={design} selectedId={selectedId} accent={context.accent} websiteUrl={context.websiteUrl} actions={actions} linkPresets={profile.linkPresets} extraVisibility={profile.extraVisibility} />
  );
  const leftTabs: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
    { id: "blocks", label: "Añadir", icon: <Plus size={14} aria-hidden="true" data-testid={`${tp}-tab-blocks-icon`} /> },
    { id: "layers", label: "Capas", icon: <Layers size={14} aria-hidden="true" data-testid={`${tp}-tab-layers-icon`} /> },
    ...(!inspectorRight ? [{ id: "style" as const, label: "Estilo", icon: <SlidersHorizontal size={14} aria-hidden="true" data-testid={`${tp}-tab-style-icon`} /> }] : []),
  ];
  const panelBody = (requested: LeftTab) => {
    const tab = requested === "style" && inspectorRight ? "blocks" : requested;
    return tab === "blocks" ? (
      <BlockPalette blocks={profile.blocks} icons={profile.blockIcons} onAdd={(kind) => addBlock(kind)} />
    ) : tab === "layers" ? (
      <LayersPanel html={design} selectedId={selectedId} onSelect={setSelectedId} onMove={(id, target, position) => commit(moveElementTo(designRef.current, id, target, position), id)} />
    ) : (
      inspector
    );
  };
  const tabBar = (testId: string) => (
    <div role="tablist" aria-label="Paneles del editor" className="grid auto-cols-fr grid-flow-col gap-0.5 border-b border-bo-border p-1.5" data-testid={testId}>
      {leftTabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={leftTab === t.id || (leftTab === "style" && inspectorRight && t.id === "blocks")}
          onClick={() => setLeftTab(t.id)}
          className={cn("inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md border-0 text-xs font-medium transition-colors", leftTab === t.id ? "bg-bo-surface-2 text-bo-text" : "bg-transparent text-bo-muted hover:text-bo-text")}
          data-testid={`${testId}-${t.id}`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
  const showLeft = leftOpen && chat !== "wide";

  return (
    <BuilderTestIdContext.Provider value={tp}>
    <div
      className="eb-scope flex min-w-0 flex-col overflow-hidden rounded-bo-lg border border-bo-border bg-bo-surface-3 lg:h-full lg:min-h-[420px]"
      onKeyDown={onKey}
      data-testid={profile.rootTestId}
      data-observe={tp}
      data-coord-id={coordId}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-bo-border bg-bo-shell px-2 py-1.5" data-testid={`${tp}-toolbar`}>
        <ToolButton title={showLeft ? "Ocultar panel izquierdo" : "Mostrar panel izquierdo"} onClick={() => setLeftOpen((v) => !v)} active={showLeft} className="hidden lg:inline-flex" testId={`${tp}-toggle-left`}>
          <PanelLeft size={15} aria-hidden="true" data-testid={`${tp}-toggle-left-icon`} />
        </ToolButton>
        <div role="tablist" aria-label="Modo del editor" className="inline-flex items-center gap-0.5 rounded-bo-md border border-bo-border bg-bo-surface-3 p-0.5" data-testid={`${tp}-mode`}>
          {([
            ["design", "Diseño", <PenTool key="d" size={14} aria-hidden="true" data-testid={`${tp}-mode-design-icon`} />],
            ["preview", "Vista previa", <Eye key="p" size={14} aria-hidden="true" data-testid={`${tp}-mode-preview-icon`} />],
            ["code", "HTML", <Code2 key="c" size={14} aria-hidden="true" data-testid={`${tp}-mode-code-icon`} />],
          ] as const).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[7px] border-0 px-2.5 text-xs font-medium transition-colors", mode === id ? "bg-bo-surface-2 text-bo-text" : "bg-transparent text-bo-muted hover:text-bo-text")}
              data-testid={`${tp}-mode-${id}`}
            >
              {icon}
              <span className="hidden sm:inline" data-testid={`${tp}-mode-${id}-label`}>{label}</span>
            </button>
          ))}
        </div>
        <DeviceSwitch value={device} onChange={setDevice} testId={`${tp}-device`} />
        <div className="ml-auto flex items-center gap-1" data-testid={`${tp}-toolbar-end`}>
          <ToolButton title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!past.current.length} testId={`${tp}-undo`}>
            <Undo2 size={15} aria-hidden="true" data-testid={`${tp}-undo-icon`} />
          </ToolButton>
          <ToolButton title="Rehacer (Ctrl+Shift+Z)" onClick={redo} disabled={!future.current.length} testId={`${tp}-redo`}>
            <Redo2 size={15} aria-hidden="true" data-testid={`${tp}-redo-icon`} />
          </ToolButton>
          <div className="hidden sm:block" data-testid={`${tp}-zoom-cell`}>
            <Select
              size="sm"
              ariaLabel="Zoom"
              value={String(zoom)}
              onChange={(v) => setZoom(v === "fit" ? "fit" : Number(v))}
              options={[
                { value: "fit", label: "Ajustar" },
                { value: "0.5", label: "50 %" },
                { value: "0.75", label: "75 %" },
                { value: "1", label: "100 %" },
              ]}
              menuMinWidthPx={120}
              data-testid={`${tp}-zoom`}
            />
          </div>
          <ToolButton title={chat === "closed" ? "Abrir asistente IA" : "Plegar asistente IA"} onClick={() => setChat((c) => (c === "closed" ? "open" : "closed"))} active={chat !== "closed"} testId={`${tp}-chat-toggle`}>
            <Sparkles size={15} aria-hidden="true" data-testid={`${tp}-chat-toggle-icon`} />
            <span data-testid={`${tp}-chat-toggle-label`}>IA</span>
          </ToolButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row" data-testid={`${tp}-body`}>
        {lg && showLeft && (
          <aside className="flex w-[256px] shrink-0 flex-col border-r border-bo-border bg-bo-shell" aria-label="Componentes y capas" data-testid={`${tp}-left`}>
            {tabBar(`${tp}-left-tabs`)}
            <div className="min-h-0 flex-1 overflow-y-auto" data-testid={`${tp}-left-body`}>{panelBody(leftTab)}</div>
          </aside>
        )}

        <main className="relative h-[64dvh] min-h-[420px] min-w-0 lg:h-auto lg:min-h-0 lg:flex-1" data-testid={`${tp}-main`}>
          {mode === "design" && (
            <BuilderCanvas
              extraCss={profile.canvasCss}
              html={design}
              css={css}
              device={device}
              zoom={zoom}
              selectedId={selectedId}
              selectedLabel={selectedLabel}
              onSelect={select}
              onInlineEdit={(id, inner) => commit(updateElement(designRef.current, id, (el) => (el.innerHTML = inner)))}
              onDrop={onDrop}
              onKey={onKey}
            />
          )}
          {mode === "preview" && (
            <div className="h-full overflow-auto bg-[#0d0e13] p-4" data-testid={`${tp}-preview`}>
              {previewHtml ? (
                <PreviewFrame html={previewHtml} device={device} testId={`${tp}-preview-frame`} />
              ) : preview.error ? (
                <p className="m-0 p-6 text-center text-sm text-[#f87171]" role="alert" data-testid={`${tp}-preview-error`}>{preview.error}</p>
              ) : (
                <p className="m-0 p-6 text-center text-sm text-bo-muted" data-testid={`${tp}-preview-wait`}>{profile.previewWaitLabel}</p>
              )}
            </div>
          )}
          {mode === "code" && (
            <div className="flex h-full flex-col gap-2 bg-[#0d0e13] p-3" data-testid={`${tp}-code`}>
              <textarea
                className="min-h-0 flex-1 resize-none rounded-md border border-bo-border bg-bo-surface-3 p-3 font-mono text-[12px] leading-relaxed text-bo-text outline-none focus:border-[#7c5cff]/70"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.currentTarget.value)}
                aria-label="HTML del diseño con clases Tailwind"
                data-testid={`${tp}-code-input`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2" data-testid={`${tp}-code-actions`}>
                <span className="text-[11px] text-bo-faint" data-testid={`${tp}-code-help`}>HTML con clases de Tailwind. Se limpia (sin scripts ni estilos externos) al aplicar.</span>
                <button
                  type="button"
                  onClick={() => {
                    commit(normalizeDesign(code), null);
                    setMode("design");
                  }}
                  className="bo-btn bo-btn--primary bo-btn--sm"
                  data-testid={`${tp}-code-apply`}
                >
                  Aplicar HTML
                </button>
              </div>
            </div>
          )}
        </main>

        {inspectorRight && (
          <aside className="w-[292px] shrink-0 overflow-y-auto border-l border-bo-border bg-bo-shell" aria-label="Propiedades" data-testid={`${tp}-right`}>
            {inspector}
          </aside>
        )}

        {chat !== "closed" && (
          <div
            className={cn("fixed inset-0 z-[180] lg:static lg:z-auto lg:shrink-0", chat === "wide" ? "lg:w-[520px]" : "lg:w-[360px]")}
            data-testid={`${tp}-chat-dock`}
          >
            <BuilderChat
              ai={profile.ai}
              html={aiDesign}
              selectedHtml={aiSelection}
              selectedLabel={selectedLabel}
              coordId={coordId}
              layout={chat}
              onLayout={setChat}
              onClose={() => setChat("closed")}
              onApply={applyAI}
              onRestore={restore}
            />
          </div>
        )}
        {chat === "closed" && (
          <button
            type="button"
            onClick={() => setChat("open")}
            className="hidden w-11 shrink-0 cursor-pointer flex-col items-center gap-2 border-0 border-l border-solid border-bo-border bg-bo-shell pt-3 text-bo-muted transition hover:text-[#cfc4ff] lg:flex"
            title="Abrir asistente IA"
            data-testid={`${tp}-chat-rail`}
          >
            <Sparkles size={16} aria-hidden="true" data-testid={`${tp}-chat-rail-icon`} />
            <span className="text-[11px] font-semibold [writing-mode:vertical-rl]" data-testid={`${tp}-chat-rail-label`}>Asistente IA</span>
          </button>
        )}

        {/* Phones and small tablets: the same panels as tabs under the canvas
            (mounted instead of the side panel, never next to it). */}
        {!lg && (
          <section className="border-t border-bo-border bg-bo-shell" aria-label="Paneles del editor" data-testid={`${tp}-mobile-panels`}>
            {tabBar(`${tp}-mobile-tabs`)}
            <div className="max-h-[60dvh] overflow-y-auto" data-testid={`${tp}-mobile-body`}>{panelBody(leftTab)}</div>
          </section>
        )}
      </div>
    </div>
    </BuilderTestIdContext.Provider>
  );
}
