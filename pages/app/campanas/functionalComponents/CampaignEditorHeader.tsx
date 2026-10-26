import React from "react";
import { ArrowLeft, Check, CircleDot, Loader2, Mail, Megaphone, MessageCircle, Save, Send, Trash2, Users } from "lucide-react";
import type { Campaign, CampaignChannel } from "../../../../api/types";
import { Button } from "../../../../ui/actions/Button";
import { cn } from "../../../../ui/shadcn/utils";
import { CampaignStatusBadge, CAMPAIGN_CHANNEL_UI } from "./campaignUi";

/*
 * Header of the campaign editor (campaign-editor-header): the campaign identity
 * edited in place (name and subject), where it stands (status, channels,
 * audience, progress, save state) and its actions. One compact bar on desktop
 * so the editor below keeps the whole viewport; stacked on phones.
 */

export type CampaignSaveState = "new" | "saving" | "dirty" | "saved";

type Props = {
  name: string;
  subject: string;
  status?: Campaign["status"];
  channels: CampaignChannel[];
  audienceSummary: string;
  sent: number;
  total: number;
  saveState: CampaignSaveState;
  canSend: boolean;
  canDelete: boolean;
  busy: boolean;
  backHref: string;
  onBack: () => void;
  onNameChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onSave: () => void;
  onSend: () => void;
  onDelete: () => void;
};

const SAVE_STATE_UI: Record<CampaignSaveState, { label: string; tone: string }> = {
  new: { label: "Borrador sin guardar", tone: "text-bo-faint" },
  saving: { label: "Guardando…", tone: "text-bo-muted" },
  dirty: { label: "Cambios sin guardar", tone: "text-[var(--bo-on-surface-warning)]" },
  saved: { label: "Todo guardado", tone: "text-[var(--bo-on-surface-success)]" },
};

const INLINE_INPUT =
  "min-w-0 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 outline-none transition placeholder:text-bo-faint hover:border-bo-border-2 focus:border-[#7c5cff]/70 focus:bg-bo-surface-3";

export function CampaignEditorHeader(props: Props) {
  const { saveState, channels } = props;
  const save = SAVE_STATE_UI[saveState];
  return (
    <header
      className="eb-scope grid gap-3 rounded-bo-lg border border-bo-border bg-bo-shell px-3 py-2.5 shadow-[var(--bo-shadow-soft)] md:sticky md:top-0 md:z-30 lg:static lg:flex lg:items-center lg:gap-4"
      data-testid="campaign-editor-header"
      data-observe="campaign-editor-header"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5" data-testid="campaign-editor-identity">
        <a
          href={props.backHref}
          onClick={(e) => {
            e.preventDefault();
            props.onBack();
          }}
          className="grid size-9 shrink-0 place-items-center rounded-bo-md border border-bo-border text-bo-muted no-underline transition hover:border-bo-border-2 hover:text-bo-text"
          aria-label="Volver a campañas"
          title="Volver a campañas"
          data-testid="campaign-editor-back"
        >
          <ArrowLeft size={16} aria-hidden="true" data-testid="campaign-editor-back-icon" />
        </a>
        <span className="mt-0.5 hidden size-8 shrink-0 place-items-center rounded-bo-sm border border-bo-border-2 bg-bo-surface-2 text-bo-accent sm:grid" aria-hidden="true" data-testid="campaign-editor-mark">
          <Megaphone size={15} data-testid="campaign-editor-mark-icon" />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5" data-testid="campaign-editor-title">
          <div className="flex min-w-0 flex-wrap items-center gap-2" data-testid="campaign-editor-title-row">
            <input
              className={cn(INLINE_INPUT, "w-full max-w-[28rem] text-base font-semibold text-bo-text sm:w-auto sm:min-w-[14ch] sm:[field-sizing:content] sm:text-lg")}
              value={props.name}
              placeholder="Campaña sin nombre"
              aria-label="Nombre interno de la campaña"
              title="Nombre interno (solo para el equipo)"
              onChange={(e) => props.onNameChange(e.currentTarget.value)}
              data-testid="campaign-name-field"
              data-observe="campaign-editor-name"
            />
            <CampaignStatusBadge status={props.status} testId="campaign-editor-status" />
          </div>
          <label className="flex min-w-0 items-center gap-1 text-sm text-bo-muted" data-testid="campaign-editor-subject">
            <span className="shrink-0 pl-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-bo-faint" data-testid="campaign-editor-subject-caption">
              Asunto
            </span>
            <input
              className={cn(INLINE_INPUT, "w-full max-w-[34rem] text-sm text-bo-muted sm:w-auto sm:min-w-[24ch] sm:[field-sizing:content]")}
              value={props.subject}
              placeholder="Escribe el asunto del email"
              aria-label="Asunto del email"
              onChange={(e) => props.onSubjectChange(e.currentTarget.value)}
              data-testid="campaign-subject-field"
              data-observe="campaign-editor-subject"
            />
          </label>
          <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 pl-1.5 pt-0.5" aria-label="Resumen de la campaña" data-testid="campaign-editor-meta">
            {channels.map((channel) => (
              <li
                key={channel}
                className="inline-flex items-center gap-1 rounded-bo-full border border-bo-border px-2 py-0.5 text-[11px] text-bo-muted"
                data-testid={`campaign-editor-meta-channel-${channel}`}
              >
                {channel === "email" ? (
                  <Mail size={12} aria-hidden="true" data-testid={`campaign-editor-meta-channel-${channel}-icon`} />
                ) : (
                  <MessageCircle size={12} aria-hidden="true" data-testid={`campaign-editor-meta-channel-${channel}-icon`} />
                )}
                {CAMPAIGN_CHANNEL_UI[channel].label}
              </li>
            ))}
            <li className="inline-flex items-center gap-1 rounded-bo-full border border-bo-border px-2 py-0.5 text-[11px] text-bo-muted" data-testid="campaign-editor-meta-audience">
              <Users size={12} aria-hidden="true" data-testid="campaign-editor-meta-audience-icon" />
              {props.audienceSummary}
            </li>
            <li className="text-[11px] text-bo-faint" data-testid="campaign-editor-meta-progress" data-observe="campaign-editor-meta-progress">
              {props.sent}/{props.total} enviados
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 lg:shrink-0 lg:justify-end" data-testid="campaign-editor-actions">
        <span className={cn("inline-flex items-center gap-1.5 text-xs", save.tone)} role="status" aria-live="polite" data-testid="campaign-editor-save-state" data-state={saveState}>
          {saveState === "saving" ? (
            <Loader2 size={13} className="animate-spin" aria-hidden="true" data-testid="campaign-editor-save-state-icon-saving" />
          ) : saveState === "saved" ? (
            <Check size={13} aria-hidden="true" data-testid="campaign-editor-save-state-icon-saved" />
          ) : (
            <CircleDot size={13} aria-hidden="true" data-testid="campaign-editor-save-state-icon-pending" />
          )}
          {save.label}
        </span>
        <div className="flex items-center gap-2" data-testid="campaign-editor-buttons">
          <Button
            variant="primary"
            size="sm"
            className="min-h-10 sm:min-h-0"
            onClick={props.onSave}
            disabled={props.busy}
            title="Guardar (Ctrl+S)"
            data-testid="campaign-save-btn"
          >
            <Save size={15} aria-hidden="true" data-testid="campaign-save-btn-icon" /> Guardar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-10 sm:min-h-0"
            onClick={props.onSend}
            disabled={!props.canSend || props.busy}
            title={props.canSend ? "Enviar la campaña" : saveState === "dirty" ? "Guarda los cambios antes de enviar" : "Guarda la campaña para poder enviarla"}
            data-testid="campaign-send-btn"
          >
            <Send size={15} aria-hidden="true" data-testid="campaign-send-btn-icon" /> Enviar
          </Button>
          {props.canDelete && (
            <Button
              variant="danger"
              size="sm"
              className="min-h-10 min-w-10 sm:min-h-0 sm:min-w-0"
              aria-label="Eliminar campaña"
              title="Eliminar campaña"
              onClick={props.onDelete}
              disabled={props.busy}
              data-testid="campaign-delete-btn"
            >
              <Trash2 size={15} aria-hidden="true" data-testid="campaign-delete-btn-icon" />
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
