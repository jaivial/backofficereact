import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Maximize2, Minimize2, PanelRightClose, Sparkles, Trash } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";
import { isConfigContentAllowed } from "../../lib/navigation";
import { Select } from "../inputs/Select";
import type { CampaignAIChatMessage, CampaignAIModel } from "../../api/types";
import { cn } from "../shadcn/utils";
import { PromptComposer } from "../hairline/prompt-composer";
import { ThinkingIndicator } from "../hairline/thinking-indicator";
import { ChatScroll } from "../hairline/chat-scroll";
import { ChatNotice } from "../hairline/chat-notice";
import { ActionReceipts, type Receipt } from "../hairline/action-receipt";
import { useBuilderTestId } from "./testIds";

/*
 * AI assistant of the campaign HTML builder (coordination id
 * campaign_html_builder_ai_v1), built from Hairline UI chat components. The
 * operator talks to the models configured for the restaurant; every answer that
 * carries a new design is applied to the canvas at once and leaves a receipt
 * with Undo. The conversation stays in the browser.
 */

export type ChatLayout = "open" | "wide";

type Turn = { id: string; role: "user" | "assistant"; content: string; receipt?: Receipt };

/** AI backend of a builder profile (campaign email, web ad). */
export type BuilderAI = {
  /** Accessible name of the chat panel. */
  ariaLabel: string;
  suggestions: string[];
  models: () => Promise<{ models: CampaignAIModel[]; default: string } | null>;
  chat: (input: { model: string; messages: CampaignAIChatMessage[]; html: string; selected_html: string; coord_id: string }) => Promise<
    { success: true; reply?: string; html?: string; model?: string } | { success: false; message?: string }
  >;
};

type Props = {
  ai: BuilderAI;
  /** Current design without editing ids. */
  html: string;
  selectedHtml: string;
  selectedLabel: string;
  coordId: string;
  layout: ChatLayout;
  onLayout: (layout: ChatLayout) => void;
  onClose: () => void;
  /** Applies a design from the AI; returns the design it replaced (for Undo). */
  onApply: (html: string) => string;
  onRestore: (html: string) => void;
};

const UNDO_WINDOW = 120_000;

/** Where the restaurant's AI models are configured. */
const AI_CONFIG_HREF = "/app/config?content=ia";

const turnId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function BuilderChat({ ai, html, selectedHtml, selectedLabel, coordId, layout, onLayout, onClose, onApply, onRestore }: Props) {
  const tp = useBuilderTestId();
  const [models, setModels] = useState<CampaignAIModel[]>([]);
  const [model, setModel] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busySince, setBusySince] = useState<number | null>(null);
  const [error, setError] = useState<{ message: string; prompt: string } | null>(null);
  const [useSelection, setUseSelection] = useState(true);
  const snapshots = useRef(new Map<string, string>());
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const user = usePageContext().bo?.session?.user;
  // Only offer the shortcut to people who can actually open that config tab.
  const canConfigureAI = isConfigContentAllowed("ia", user?.role, user?.sectionAccess, user?.roleImportance, user?.appVersion);

  useEffect(() => {
    let alive = true;
    void ai
      .models()
      .then((res) => {
        if (!alive || !res) return;
        setModels(res.models);
        setModel(res.default || res.models[0]?.id || "");
      })
      .catch(() => alive && setModels([]))
      .finally(() => alive && setModelsLoaded(true));
    return () => {
      alive = false;
    };
  }, [ai]);


  const send = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text || busySince) return;
      const history: CampaignAIChatMessage[] = [...turns.map((t) => ({ role: t.role, content: t.content })), { role: "user", content: text }];
      setTurns((prev) => [...prev, { id: turnId(), role: "user", content: text }]);
      setDraft("");
      setError(null);
      setBusySince(Date.now());
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await ai.chat({ model, messages: history, html, selected_html: useSelection ? selectedHtml : "", coord_id: coordId });
        if (controller.signal.aborted) return;
        if (!res.success) throw new Error(res.message || "El asistente no ha podido responder");
        let receipt: Receipt | undefined;
        if (res.html) {
          const id = turnId();
          snapshots.current.set(id, onApply(res.html));
          receipt = { id, title: "Cambios aplicados", detail: `${models.find((m) => m.id === res.model)?.name ?? res.model ?? model} · ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`, status: "done", undoUntil: Date.now() + UNDO_WINDOW };
        }
        setTurns((prev) => [...prev, { id: turnId(), role: "assistant", content: res.reply || "Hecho.", receipt }]);
      } catch (err) {
        if (!controller.signal.aborted) setError({ message: err instanceof Error ? err.message : "Error inesperado", prompt: text });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setBusySince(null);
      }
    },
    [ai, busySince, coordId, html, model, models, onApply, selectedHtml, turns, useSelection],
  );

  const stop = () => {
    abortRef.current?.abort();
    setBusySince(null);
  };

  const undo = (id: string) => {
    const previous = snapshots.current.get(id);
    if (previous === undefined) return;
    onRestore(previous);
    snapshots.current.delete(id);
    setTurns((prev) => prev.map((t) => (t.receipt?.id === id ? { ...t, receipt: { ...t.receipt, status: "undone" } } : t)));
  };

  return (
    <aside
      className="eb-chat-open flex h-full min-h-0 flex-col border-l border-bo-border bg-bo-shell"
      aria-label={ai.ariaLabel}
      data-testid={`${tp}-chat`}
      data-observe={`${tp}-chat`}
      data-coord-id={coordId}
      data-layout={layout}
    >
      <header className="flex items-center gap-2 border-b border-bo-border px-3 py-2.5" data-testid={`${tp}-chat-header`}>
        <span className="grid size-7 place-items-center rounded-lg bg-[#7c5cff]/20 text-[#b9a8ff]" data-testid={`${tp}-chat-icon`}>
          <Sparkles size={15} aria-hidden="true" data-testid={`${tp}-chat-icon-svg`} />
        </span>
        <div className="min-w-0 flex-1" data-testid={`${tp}-chat-heading`}>
          <p className="m-0 text-[13px] font-semibold text-bo-text" data-testid={`${tp}-chat-title`}>Asistente IA</p>
          <p className="m-0 truncate text-[11px] text-bo-faint" data-testid={`${tp}-chat-subtitle`}>Edita el diseño en tiempo real</p>
        </div>
        {turns.length > 0 && (
          <button type="button" title="Nueva conversación" aria-label="Nueva conversación" onClick={() => { setTurns([]); setError(null); }} className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-bo-muted hover:bg-bo-surface-2 hover:text-bo-text" data-testid={`${tp}-chat-clear`}>
            <Trash size={14} aria-hidden="true" data-testid={`${tp}-chat-clear-icon`} />
          </button>
        )}
        <button
          type="button"
          title={layout === "wide" ? "Reducir chat" : "Ampliar chat"}
          aria-label={layout === "wide" ? "Reducir chat" : "Ampliar chat"}
          onClick={() => onLayout(layout === "wide" ? "open" : "wide")}
          className="hidden size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-bo-muted hover:bg-bo-surface-2 hover:text-bo-text lg:grid"
          data-testid={`${tp}-chat-expand`}
        >
          {layout === "wide" ? <Minimize2 size={14} aria-hidden="true" data-testid={`${tp}-chat-expand-icon-minimize`} /> : <Maximize2 size={14} aria-hidden="true" data-testid={`${tp}-chat-expand-icon-maximize`} />}
        </button>
        <button type="button" title="Plegar chat" aria-label="Plegar chat" onClick={onClose} className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-bo-muted hover:bg-bo-surface-2 hover:text-bo-text" data-testid={`${tp}-chat-collapse`}>
          <PanelRightClose size={15} aria-hidden="true" data-testid={`${tp}-chat-collapse-icon`} />
        </button>
      </header>

      <ChatScroll className="flex-1" contentClassName="grid content-start gap-3 px-3 py-4" followKey={turns.length} data-testid={`${tp}-chat-scroll`}>
        {modelsLoaded && !models.length && (
          <div className="grid gap-2 rounded-xl border border-bo-border bg-bo-surface-3 p-3" data-testid={`${tp}-chat-no-models`}>
            <p className="m-0 text-[13px] font-medium text-bo-text" data-testid={`${tp}-chat-no-models-title`}>No hay ningún modelo de IA configurado</p>
            <p className="m-0 text-[12.5px] leading-relaxed text-bo-muted" data-testid={`${tp}-chat-no-models-help`}>
              {canConfigureAI
                ? "Añade la clave del proveedor y elige el modelo en la configuración de IA del restaurante."
                : "Pide a un administrador que configure un modelo de IA para este restaurante."}
            </p>
            {canConfigureAI && (
              <a href={AI_CONFIG_HREF} className="bo-btn bo-btn--primary bo-btn--sm justify-self-start no-underline" data-testid={`${tp}-chat-config-ai`}>
                <ExternalLink size={14} aria-hidden="true" data-testid={`${tp}-chat-config-ai-icon`} /> Configurar IA
              </a>
            )}
          </div>
        )}
        {turns.length === 0 && models.length > 0 && (
          <div className="grid gap-3" data-testid={`${tp}-chat-empty`}>
            <p className="m-0 text-[13px] leading-relaxed text-bo-muted" data-testid={`${tp}-chat-intro`}>
              Pídeme cambios sobre el email y los verás al momento en el lienzo. Si seleccionas un elemento, trabajaré sobre él.
            </p>
            <div className="grid gap-1.5" data-testid={`${tp}-chat-suggestions`}>
              {ai.suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={!model}
                  className="cursor-pointer rounded-lg border border-solid border-bo-border bg-bo-surface-3 px-3 py-2 text-left text-[12.5px] leading-snug text-bo-text transition hover:border-[#7c5cff]/60 disabled:opacity-50"
                  data-testid={`${tp}-chat-suggestion-${i}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className={cn("grid gap-2", t.role === "user" ? "justify-items-end" : "justify-items-start")} data-testid={`${tp}-chat-turn-${t.id}`} data-role={t.role}>
            <div
              className={cn(
                "max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                t.role === "user" ? "rounded-br-md bg-[#7c5cff] text-white" : "rounded-bl-md bg-bo-surface-2 text-bo-text",
              )}
              data-testid={`${tp}-chat-bubble-${t.id}`}
            >
              {t.content}
            </div>
            {t.receipt && <ActionReceipts className="justify-self-stretch rounded-xl border border-bo-border bg-bo-surface-3 px-2" actions={[t.receipt]} onUndo={undo} undoWindow={UNDO_WINDOW} stackFrom={0} data-testid={`${tp}-chat-receipt-${t.id}`} />}
          </div>
        ))}
        {busySince && <ThinkingIndicator variant="orbit" label="Diseñando" startedAt={busySince} className="px-1 text-bo-muted" data-testid={`${tp}-chat-thinking`} />}
        {error && (
          <ChatNotice kind="error" description={error.message} onRetry={() => void send(error.prompt)} data-testid={`${tp}-chat-error`} />
        )}
      </ChatScroll>

      <div ref={composerRef} className="grid gap-2 border-t border-bo-border p-3" data-testid={`${tp}-chat-footer`}>
        {selectedHtml && (
          <label className="flex items-center gap-2 text-[11.5px] text-bo-muted" data-testid={`${tp}-chat-selection`}>
            <input type="checkbox" checked={useSelection} onChange={(e) => setUseSelection(e.currentTarget.checked)} className="accent-[#7c5cff]" data-testid={`${tp}-chat-selection-toggle`} />
            <span className="truncate" data-testid={`${tp}-chat-selection-label`}>Centrarse en «{selectedLabel}»</span>
          </label>
        )}
        <PromptComposer
          value={draft}
          onValueChange={setDraft}
          onSubmit={(v) => void send(v)}
          onStop={stop}
          status={busySince ? "streaming" : "ready"}
          placeholder={models.length ? "Describe el cambio que quieres…" : "Configura un modelo de IA en Configuración → IA"}
          disabled={!models.length}
          toolbar={
            models.length ? (
              <Select
                size="sm"
                ariaLabel="Modelo de IA"
                value={model}
                onChange={setModel}
                options={models.map((m) => ({ value: m.id, label: m.name }))}
                menuMinWidthPx={200}
                data-testid={`${tp}-chat-model`}
              />
            ) : undefined
          }
          data-testid={`${tp}-chat-composer`}
        />
      </div>
    </aside>
  );
}
