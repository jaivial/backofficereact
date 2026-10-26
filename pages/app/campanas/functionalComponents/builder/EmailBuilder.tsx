import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Code2, Eye, Layers, Loader2, PanelLeft, PenTool, Plus, Redo2, SlidersHorizontal, Sparkles, Undo2 } from "lucide-react";
import { cn } from "../../../../../ui/shadcn/utils";
import { blockByKind, type BlockContext, type BlockKind } from "./emailBuilderBlocks";
import {
  duplicateElement, elementHtml, elementLabel, findById, insertSnippet, moveElement, moveElementTo, normalizeDesign, parentId,
  parseFragment, removeElement, stripIds, updateElement, type InsertPosition,
} from "./emailBuilderDocument";
import { fetchDesignCss, fillPreviewPlaceholders, inlineEmail } from "./emailBuilderCompile";
import { EmailBuilderCanvas, type BuilderDevice, type CanvasDrop } from "./EmailBuilderCanvas";
import { BlockPalette, LayersPanel } from "./EmailBuilderPanels";
import { EmailBuilderInspector } from "./EmailBuilderInspector";
import { EmailBuilderChat, type ChatLayout } from "./EmailBuilderChat";
import { DeviceSwitch, EmailPreviewFrame } from "./EmailPreviewFrame";

/*
 * Campaign HTML builder (coordination id campaign_html_builder_v1): a
 * Figma-like editor for the campaign email. Left: components and layers.
 * Centre: the design on a canvas at desktop, tablet or phone width. Right: the
 * properties of the selection and the AI assistant, which edits the same
 * design live. The design is Tailwind HTML; what is stored is that HTML (ids
 * stripped) and the email is compiled from it on save.
 */

type Props = {
  /** Stored design (no editing ids); empty while the seed is not ready. */
  value: string;
  onChange: (html: string) => void;
  context: BlockContext;
  subject: string;
  coordId: string;
  unsubscribePreviewUrl: string;
  onUploadImage?: (file: File) => Promise<string>;
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

export function EmailBuilder({ value, onChange, context, subject, coordId, unsubscribePreviewUrl, onUploadImage }: Props) {
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
  const [cssState, setCssState] = useState<"idle" | "busy" | "error">("idle");
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
      setCssState("busy");
      fetchDesignCss(stripIds(design), coordId, controller.signal)
        .then((next) => {
          setCss(next);
          setCssState("idle");
        })
        .catch(() => !controller.signal.aborted && setCssState("error"));
    }, 160);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [design, coordId]);

  const selected = useMemo(() => findById(parseFragment(design), selectedId), [design, selectedId]);
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
    (kind: BlockKind, targetId: string | null = selectedId, position: InsertPosition | "block-after" = "block-after") => {
      const block = blockByKind(kind);
      if (!block) return;
      const res = insertSnippet(designRef.current, block.html(context), targetId, position);
      commit(res.html, res.id);
    },
    [commit, context, selectedId],
  );

  const onDrop = useCallback(
    (drop: CanvasDrop) => {
      if (drop.block) addBlock(drop.block as BlockKind, drop.targetId, drop.position);
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

  const previewHtml = useMemo(
    () => (mode === "preview" && design && css ? fillPreviewPlaceholders(inlineEmail(design, css, subject || "Campaña"), unsubscribePreviewUrl) : ""),
    [css, design, mode, subject, unsubscribePreviewUrl],
  );

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
      <div className="grid min-h-[420px] place-items-center rounded-bo-lg border border-bo-border bg-bo-surface-3 text-sm text-bo-muted" data-testid="email-builder-loading">
        <span className="inline-flex items-center gap-2" data-testid="email-builder-loading-label">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Preparando el editor…
        </span>
      </div>
    );
  }

  const inspector = (
    <EmailBuilderInspector html={design} selectedId={selectedId} accent={context.accent} websiteUrl={context.websiteUrl} actions={actions} />
  );
  const leftTabs: { id: LeftTab; label: string; icon: React.ReactNode }[] = [
    { id: "blocks", label: "Añadir", icon: <Plus size={14} aria-hidden="true" /> },
    { id: "layers", label: "Capas", icon: <Layers size={14} aria-hidden="true" /> },
    ...(!inspectorRight ? [{ id: "style" as const, label: "Estilo", icon: <SlidersHorizontal size={14} aria-hidden="true" /> }] : []),
  ];
  const panelBody = (requested: LeftTab) => {
    const tab = requested === "style" && inspectorRight ? "blocks" : requested;
    return tab === "blocks" ? (
      <BlockPalette onAdd={(kind) => addBlock(kind)} />
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
    <div
      className="eb-scope flex min-w-0 flex-col overflow-hidden rounded-bo-lg border border-bo-border bg-bo-surface-3 lg:h-[calc(100dvh-20rem)] lg:min-h-[600px]"
      onKeyDown={onKey}
      data-testid="campaign-content-panel"
      data-observe="email-builder"
      data-coord-id={coordId}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-bo-border bg-bo-shell px-2 py-1.5" data-testid="email-builder-toolbar">
        <ToolButton title={showLeft ? "Ocultar panel izquierdo" : "Mostrar panel izquierdo"} onClick={() => setLeftOpen((v) => !v)} active={showLeft} className="hidden lg:inline-flex" testId="email-builder-toggle-left">
          <PanelLeft size={15} aria-hidden="true" />
        </ToolButton>
        <div role="tablist" aria-label="Modo del editor" className="inline-flex items-center gap-0.5 rounded-bo-md border border-bo-border bg-bo-surface-3 p-0.5" data-testid="email-builder-mode">
          {([
            ["design", "Diseño", <PenTool key="d" size={14} aria-hidden="true" />],
            ["preview", "Vista previa", <Eye key="p" size={14} aria-hidden="true" />],
            ["code", "HTML", <Code2 key="c" size={14} aria-hidden="true" />],
          ] as const).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[7px] border-0 px-2.5 text-xs font-medium transition-colors", mode === id ? "bg-bo-surface-2 text-bo-text" : "bg-transparent text-bo-muted hover:text-bo-text")}
              data-testid={`email-builder-mode-${id}`}
            >
              {icon}
              <span className="hidden sm:inline" data-testid={`email-builder-mode-${id}-label`}>{label}</span>
            </button>
          ))}
        </div>
        <DeviceSwitch value={device} onChange={setDevice} testId="email-builder-device" />
        <div className="ml-auto flex items-center gap-1" data-testid="email-builder-toolbar-end">
          <span className="hidden items-center gap-1 text-[11px] text-bo-faint md:inline-flex" data-testid="email-builder-css-state" data-state={cssState}>
            {cssState === "busy" ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> Compilando</> : cssState === "error" ? <span className="text-[#ff9c9c]">CSS sin compilar</span> : "Tailwind ✓"}
          </span>
          <ToolButton title="Deshacer (Ctrl+Z)" onClick={undo} disabled={!past.current.length} testId="email-builder-undo">
            <Undo2 size={15} aria-hidden="true" />
          </ToolButton>
          <ToolButton title="Rehacer (Ctrl+Shift+Z)" onClick={redo} disabled={!future.current.length} testId="email-builder-redo">
            <Redo2 size={15} aria-hidden="true" />
          </ToolButton>
          <select
            aria-label="Zoom"
            value={String(zoom)}
            onChange={(e) => setZoom(e.currentTarget.value === "fit" ? "fit" : Number(e.currentTarget.value))}
            className="hidden h-8 rounded-md border border-bo-border bg-bo-surface-3 px-1.5 text-xs text-bo-text sm:block"
            data-testid="email-builder-zoom"
          >
            <option value="fit" data-testid="email-builder-zoom-fit">Ajustar</option>
            <option value="0.5" data-testid="email-builder-zoom-50">50 %</option>
            <option value="0.75" data-testid="email-builder-zoom-75">75 %</option>
            <option value="1" data-testid="email-builder-zoom-100">100 %</option>
          </select>
          <ToolButton title={chat === "closed" ? "Abrir asistente IA" : "Plegar asistente IA"} onClick={() => setChat((c) => (c === "closed" ? "open" : "closed"))} active={chat !== "closed"} testId="email-builder-chat-toggle">
            <Sparkles size={15} aria-hidden="true" />
            <span data-testid="email-builder-chat-toggle-label">IA</span>
          </ToolButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row" data-testid="email-builder-body">
        {lg && showLeft && (
          <aside className="flex w-[256px] shrink-0 flex-col border-r border-bo-border bg-bo-shell" aria-label="Componentes y capas" data-testid="email-builder-left">
            {tabBar("email-builder-left-tabs")}
            <div className="min-h-0 flex-1 overflow-y-auto" data-testid="email-builder-left-body">{panelBody(leftTab)}</div>
          </aside>
        )}

        <main className="relative h-[64dvh] min-h-[420px] min-w-0 lg:h-auto lg:min-h-0 lg:flex-1" data-testid="email-builder-main">
          {mode === "design" && (
            <EmailBuilderCanvas
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
            <div className="h-full overflow-auto bg-[#0d0e13] p-4" data-testid="email-builder-preview">
              {previewHtml ? (
                <EmailPreviewFrame html={previewHtml} device={device} testId="email-builder-preview-frame" />
              ) : (
                <p className="m-0 p-6 text-center text-sm text-bo-muted" data-testid="email-builder-preview-wait">Compilando el email…</p>
              )}
            </div>
          )}
          {mode === "code" && (
            <div className="flex h-full flex-col gap-2 bg-[#0d0e13] p-3" data-testid="email-builder-code">
              <textarea
                className="min-h-0 flex-1 resize-none rounded-md border border-bo-border bg-bo-surface-3 p-3 font-mono text-[12px] leading-relaxed text-bo-text outline-none focus:border-[#7c5cff]/70"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.currentTarget.value)}
                aria-label="HTML del diseño con clases Tailwind"
                data-testid="email-builder-code-input"
              />
              <div className="flex flex-wrap items-center justify-between gap-2" data-testid="email-builder-code-actions">
                <span className="text-[11px] text-bo-faint" data-testid="email-builder-code-help">HTML con clases de Tailwind. Se limpia (sin scripts ni estilos externos) al aplicar.</span>
                <button
                  type="button"
                  onClick={() => {
                    commit(normalizeDesign(code), null);
                    setMode("design");
                  }}
                  className="bo-btn bo-btn--primary bo-btn--sm"
                  data-testid="email-builder-code-apply"
                >
                  Aplicar HTML
                </button>
              </div>
            </div>
          )}
        </main>

        {inspectorRight && (
          <aside className="w-[292px] shrink-0 overflow-y-auto border-l border-bo-border bg-bo-shell" aria-label="Propiedades" data-testid="email-builder-right">
            {inspector}
          </aside>
        )}

        {chat !== "closed" && (
          <div
            className={cn("fixed inset-0 z-[180] lg:static lg:z-auto lg:shrink-0", chat === "wide" ? "lg:w-[520px]" : "lg:w-[360px]")}
            data-testid="email-builder-chat-dock"
          >
            <EmailBuilderChat
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
            data-testid="email-builder-chat-rail"
          >
            <Sparkles size={16} aria-hidden="true" />
            <span className="text-[11px] font-semibold [writing-mode:vertical-rl]" data-testid="email-builder-chat-rail-label">Asistente IA</span>
          </button>
        )}

        {/* Phones and small tablets: the same panels as tabs under the canvas
            (mounted instead of the side panel, never next to it). */}
        {!lg && (
          <section className="border-t border-bo-border bg-bo-shell" aria-label="Paneles del editor" data-testid="email-builder-mobile-panels">
            {tabBar("email-builder-mobile-tabs")}
            <div className="max-h-[60dvh] overflow-y-auto" data-testid="email-builder-mobile-body">{panelBody(leftTab)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
