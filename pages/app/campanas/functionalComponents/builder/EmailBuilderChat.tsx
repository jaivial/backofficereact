import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, PanelRightClose, Sparkles, Trash } from "lucide-react";
import { createClient } from "../../../../../api/client";
import type { CampaignAIChatMessage, CampaignAIModel } from "../../../../../api/types";
import { cn } from "../../../../../ui/shadcn/utils";
import { PromptComposer } from "../../../../../ui/hairline/prompt-composer";
import { ModelPicker, type ModelOption } from "../../../../../ui/hairline/model-picker";
import { ThinkingIndicator } from "../../../../../ui/hairline/thinking-indicator";
import { ChatScroll } from "../../../../../ui/hairline/chat-scroll";
import { ChatNotice } from "../../../../../ui/hairline/chat-notice";
import { ActionReceipts, type Receipt } from "../../../../../ui/hairline/action-receipt";

/*
 * AI assistant of the campaign HTML builder (coordination id
 * campaign_html_builder_ai_v1), built from Hairline UI chat components. The
 * operator talks to the models configured for the restaurant; every answer that
 * carries a new design is applied to the canvas at once and leaves a receipt
 * with Undo. The conversation stays in the browser.
 */

export type ChatLayout = "open" | "wide";

type Turn = { id: string; role: "user" | "assistant"; content: string; receipt?: Receipt };

type Props = {
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
const SUGGESTIONS = [
  "Hazlo más elegante, con más aire y una tipografía más grande en el titular",
  "Añade una sección de 3 platos destacados en columnas",
  "Cambia la paleta a tonos cálidos mediterráneos",
  "Añade un cupón del 10 % y un botón para reservar",
];

const turnId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function EmailBuilderChat({ html, selectedHtml, selectedLabel, coordId, layout, onLayout, onClose, onApply, onRestore }: Props) {
  const api = useMemo(() => createClient({ baseUrl: "" }).config, []);
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

  useEffect(() => {
    let alive = true;
    void api
      .campaignAIModels()
      .then((res) => {
        if (!alive || !res.success) return;
        setModels(res.models ?? []);
        setModel(res.default || res.models?.[0]?.id || "");
      })
      .catch(() => alive && setModels([]));
    return () => {
      alive = false;
    };
  }, [api]);

  const options: ModelOption[] = models.map((m) => ({ id: m.id, name: m.name, description: m.label, speed: 3, intelligence: 2 }));

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
        const res = await api.campaignAIChat({ model, messages: history, html, selected_html: useSelection ? selectedHtml : "", coord_id: coordId });
        if (controller.signal.aborted) return;
        if (!res.success) throw new Error(("message" in res && res.message) || "El asistente no ha podido responder");
        let receipt: Receipt | undefined;
        if (res.html) {
          const id = turnId();
          snapshots.current.set(id, onApply(res.html));
          receipt = { id, title: "Cambios aplicados", detail: `${models.find((m) => m.id === res.model)?.name ?? res.model} · ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`, status: "done", undoUntil: Date.now() + UNDO_WINDOW };
        }
        setTurns((prev) => [...prev, { id: turnId(), role: "assistant", content: res.reply || "Hecho.", receipt }]);
      } catch (err) {
        if (!controller.signal.aborted) setError({ message: err instanceof Error ? err.message : "Error inesperado", prompt: text });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setBusySince(null);
      }
    },
    [api, busySince, coordId, html, model, models, onApply, selectedHtml, turns, useSelection],
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
      aria-label="Asistente IA del email"
      data-testid="email-builder-chat"
      data-observe="email-builder-chat"
      data-coord-id={coordId}
      data-layout={layout}
    >
      <header className="flex items-center gap-2 border-b border-bo-border px-3 py-2.5" data-testid="email-builder-chat-header">
        <span className="grid size-7 place-items-center rounded-lg bg-[#7c5cff]/20 text-[#b9a8ff]" data-testid="email-builder-chat-icon">
          <Sparkles size={15} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1" data-testid="email-builder-chat-heading">
          <p className="m-0 text-[13px] font-semibold text-bo-text" data-testid="email-builder-chat-title">Asistente IA</p>
          <p className="m-0 truncate text-[11px] text-bo-faint" data-testid="email-builder-chat-subtitle">Edita el diseño en tiempo real</p>
        </div>
        {turns.length > 0 && (
          <button type="button" title="Nueva conversación" aria-label="Nueva conversación" onClick={() => { setTurns([]); setError(null); }} className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-bo-muted hover:bg-bo-surface-2 hover:text-bo-text" data-testid="email-builder-chat-clear">
            <Trash size={14} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          title={layout === "wide" ? "Reducir chat" : "Ampliar chat"}
          aria-label={layout === "wide" ? "Reducir chat" : "Ampliar chat"}
          onClick={() => onLayout(layout === "wide" ? "open" : "wide")}
          className="hidden size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-bo-muted hover:bg-bo-surface-2 hover:text-bo-text lg:grid"
          data-testid="email-builder-chat-expand"
        >
          {layout === "wide" ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
        </button>
        <button type="button" title="Plegar chat" aria-label="Plegar chat" onClick={onClose} className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-bo-muted hover:bg-bo-surface-2 hover:text-bo-text" data-testid="email-builder-chat-collapse">
          <PanelRightClose size={15} aria-hidden="true" />
        </button>
      </header>

      <ChatScroll className="flex-1" contentClassName="grid content-start gap-3 px-3 py-4" followKey={turns.length} data-testid="email-builder-chat-scroll">
        {turns.length === 0 && (
          <div className="grid gap-3" data-testid="email-builder-chat-empty">
            <p className="m-0 text-[13px] leading-relaxed text-bo-muted" data-testid="email-builder-chat-intro">
              Pídeme cambios sobre el email y los verás al momento en el lienzo. Si seleccionas un elemento, trabajaré sobre él.
            </p>
            <div className="grid gap-1.5" data-testid="email-builder-chat-suggestions">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  disabled={!model}
                  className="cursor-pointer rounded-lg border border-solid border-bo-border bg-bo-surface-3 px-3 py-2 text-left text-[12.5px] leading-snug text-bo-text transition hover:border-[#7c5cff]/60 disabled:opacity-50"
                  data-testid={`email-builder-chat-suggestion-${i}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className={cn("grid gap-2", t.role === "user" ? "justify-items-end" : "justify-items-start")} data-testid={`email-builder-chat-turn-${t.id}`} data-role={t.role}>
            <div
              className={cn(
                "max-w-[92%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                t.role === "user" ? "rounded-br-md bg-[#7c5cff] text-white" : "rounded-bl-md bg-bo-surface-2 text-bo-text",
              )}
              data-testid={`email-builder-chat-bubble-${t.id}`}
            >
              {t.content}
            </div>
            {t.receipt && <ActionReceipts className="justify-self-stretch rounded-xl border border-bo-border bg-bo-surface-3 px-2" actions={[t.receipt]} onUndo={undo} undoWindow={UNDO_WINDOW} data-testid={`email-builder-chat-receipt-${t.id}`} />}
          </div>
        ))}
        {busySince && <ThinkingIndicator variant="orbit" label="Diseñando" startedAt={busySince} className="px-1 text-bo-muted" data-testid="email-builder-chat-thinking" />}
        {error && (
          <ChatNotice kind="error" description={error.message} onRetry={() => void send(error.prompt)} data-testid="email-builder-chat-error" />
        )}
      </ChatScroll>

      <div ref={composerRef} className="grid gap-2 border-t border-bo-border p-3" data-testid="email-builder-chat-footer">
        {selectedHtml && (
          <label className="flex items-center gap-2 text-[11.5px] text-bo-muted" data-testid="email-builder-chat-selection">
            <input type="checkbox" checked={useSelection} onChange={(e) => setUseSelection(e.currentTarget.checked)} className="accent-[#7c5cff]" data-testid="email-builder-chat-selection-toggle" />
            <span className="truncate" data-testid="email-builder-chat-selection-label">Centrarse en «{selectedLabel}»</span>
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
          disabledReason={!models.length ? "No hay modelos de IA configurados para este restaurante." : undefined}
          maxLength={4000}
          toolbar={
            options.length ? (
              <ModelPicker models={options} value={model} onValueChange={setModel} side="top" anchorRef={composerRef} label="Modelo de IA" data-testid="email-builder-chat-model" />
            ) : undefined
          }
          data-testid="email-builder-chat-composer"
        />
      </div>
    </aside>
  );
}
