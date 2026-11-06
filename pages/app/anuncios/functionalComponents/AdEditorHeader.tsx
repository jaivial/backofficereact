import React from "react";
import { ArrowLeft, CalendarDays, Check, CircleDot, ExternalLink, Layers3, Loader2, Megaphone, Save, Square, Trash2 } from "lucide-react";
import type { RestaurantAdDesignKind } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { cn } from "../../../../ui/shadcn/utils";

/*
 * Header of the ad editor (ads_html_editor_v1): the ad name edited in place,
 * where it stands (active / scheduled, single or multiple, save state) and its
 * actions. Same compact bar as the campaign editor header.
 */

export type AdSaveState = "new" | "saving" | "dirty" | "saved";

type Props = {
  name: string;
  active: boolean;
  schedule: string;
  /** The schedule keeps the ad off the website (no dates). */
  scheduleWarn?: boolean;
  kind: RestaurantAdDesignKind;
  saveState: AdSaveState;
  canDelete: boolean;
  busy: boolean;
  /** Public website URL showing the saved ad; empty when not available. */
  liveUrl: string;
  backHref: string;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
};

const SAVE_STATE_UI: Record<AdSaveState, { label: string; tone: string }> = {
  new: { label: "Anuncio sin guardar", tone: "text-bo-faint" },
  saving: { label: "Guardando…", tone: "text-bo-muted" },
  dirty: { label: "Cambios sin guardar", tone: "text-[var(--bo-on-surface-warning)]" },
  saved: { label: "Todo guardado", tone: "text-[var(--bo-on-surface-success)]" },
};

const INLINE_INPUT =
  "min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 outline-none transition placeholder:text-bo-faint hover:border-bo-border-2 focus:border-[#7c5cff]/70 focus:bg-bo-surface-3";
const CHIP = "inline-flex items-center gap-1 rounded-bo-full border border-bo-border px-2 py-0.5 text-[11px] text-bo-muted";

export function AdEditorHeader(props: Props) {
  const save = SAVE_STATE_UI[props.saveState];
  return (
    <header
      className="ad-editorHeader eb-scope flex items-center gap-2 rounded-bo-lg border border-bo-border bg-bo-shell px-2 py-1.5 shadow-[var(--bo-shadow-soft)] md:sticky md:top-0 md:z-30 lg:static lg:gap-4"
      data-testid="ad-editor-header"
      data-observe="ad-editor-header"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5" data-testid="ad-editor-identity">
        <a
          href={props.backHref}
          onClick={(e) => {
            e.preventDefault();
            props.onBack();
          }}
          className="grid size-8 shrink-0 place-items-center rounded-bo-md border border-bo-border text-bo-muted no-underline transition hover:border-bo-border-2 hover:text-bo-text"
          aria-label="Volver a anuncios"
          title="Volver a anuncios"
          data-testid="ad-editor-back"
        >
          <ArrowLeft size={16} aria-hidden="true" data-testid="ad-editor-back-icon" />
        </a>
        <span className="hidden size-7 shrink-0 place-items-center rounded-bo-sm border border-bo-border-2 bg-bo-surface-2 text-bo-accent sm:grid" aria-hidden="true" data-testid="ad-editor-mark">
          <Megaphone size={15} data-testid="ad-editor-mark-icon" />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-1.5" data-testid="ad-editor-title">
          <input
            className={cn(INLINE_INPUT, "w-full min-w-0 max-w-[32rem] text-sm font-semibold text-bo-text sm:w-auto sm:min-w-[14ch] sm:[field-sizing:content] sm:text-base")}
            value={props.name}
            placeholder="Anuncio sin nombre"
            aria-label="Nombre interno del anuncio"
            title="Nombre interno (solo para el equipo)"
            onChange={(e) => props.onNameChange(e.currentTarget.value)}
            data-testid="ad-name-field"
            data-observe="ad-editor-name"
          />
          <ul className="m-0 flex shrink-0 list-none items-center gap-1 p-0" aria-label="Resumen del anuncio" data-testid="ad-editor-meta">
            <li
              className={cn(CHIP, props.active ? "border-[var(--bo-on-surface-success)]/40 text-[var(--bo-on-surface-success)]" : "")}
              data-testid="ad-editor-meta-status"
              data-state={props.active ? "active" : "inactive"}
            >
              <CircleDot size={12} aria-hidden="true" data-testid="ad-editor-meta-status-icon" />
              <span className="sr-only" data-testid="ad-editor-meta-status-label">{props.active ? "Activo" : "Inactivo"}</span>
            </li>
            <li className={CHIP} title={props.kind === "multiple" ? "Múltiple" : "Individual"} data-testid="ad-editor-meta-kind">
              {props.kind === "multiple" ? <Layers3 size={12} aria-hidden="true" data-testid="ad-editor-meta-kind-icon" /> : <Square size={12} aria-hidden="true" data-testid="ad-editor-meta-kind-icon" />}
              <span className="sr-only" data-testid="ad-editor-meta-kind-label">{props.kind === "multiple" ? "Múltiple" : "Individual"}</span>
            </li>
            <li className={cn(CHIP, props.scheduleWarn && "border-[var(--bo-on-surface-warning)]/40 text-[var(--bo-on-surface-warning)]")} title={props.schedule} data-testid="ad-editor-meta-schedule">
              <CalendarDays size={12} aria-hidden="true" data-testid="ad-editor-meta-schedule-icon" />
              <span className="sr-only" data-testid="ad-editor-meta-schedule-label">{props.schedule}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5" data-testid="ad-editor-actions">
        <span className={cn("inline-flex items-center text-xs", save.tone)} title={save.label} role="status" aria-live="polite" data-testid="ad-editor-save-state" data-state={props.saveState}>
          {props.saveState === "saving" ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" data-testid="ad-editor-save-state-icon-saving" />
          ) : props.saveState === "saved" ? (
            <Check size={13} aria-hidden="true" data-testid="ad-editor-save-state-icon-saved" />
          ) : (
            <CircleDot size={13} aria-hidden="true" data-testid="ad-editor-save-state-icon-pending" />
          )}
          <span className="sr-only" data-testid="ad-editor-save-state-label">{save.label}</span>
        </span>
        <div className="flex items-center gap-1.5" data-testid="ad-editor-buttons">
          <Button variant="primary" size="sm" className="size-8 min-w-0 p-0" onClick={props.onSave} disabled={props.busy} aria-label="Guardar" title="Guardar (Ctrl+S)" data-testid="ad-save-btn">
            <Save size={15} aria-hidden="true" data-testid="ad-save-btn-icon" />
          </Button>
          {props.liveUrl && (
            <a
              href={props.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bo-btn bo-btn--secondary bo-btn--sm inline-flex size-8 items-center justify-center p-0 no-underline"
              aria-label="Ver en la web"
              title="Abre la web con la versión guardada del anuncio"
              data-testid="ad-live-link"
            >
              <ExternalLink size={15} aria-hidden="true" data-testid="ad-live-link-icon" />
            </a>
          )}
          {props.canDelete && (
            <Button
              variant="danger"
              size="sm"
              className="size-8 min-w-0 p-0"
              aria-label="Eliminar anuncio"
              title="Eliminar anuncio"
              onClick={props.onDelete}
              disabled={props.busy}
              data-testid="ad-delete-btn"
            >
              <Trash2 size={15} aria-hidden="true" data-testid="ad-delete-btn-icon" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
