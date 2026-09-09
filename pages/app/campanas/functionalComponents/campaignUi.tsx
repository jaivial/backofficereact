import React, { type HTMLAttributes } from "react";
import { cn } from "../../../../ui/shadcn/utils";
import { StatusBadge } from "../../../../ui/feedback/StatusBadge";
import { Panel } from "../../../../ui/shell/Panel";
import type { Campaign, CampaignChannel } from "../../../../api/types";

/*
 * Presentational building blocks shared by the campaigns list and the campaign
 * editor. Everything here is pure markup: no fetches, no routing, no state, so
 * the pages stay in charge of behaviour and this file stays in charge of how
 * the campaigns area looks.
 */

/** Single spacing/typography rhythm shared by every field cell on the page. */
export const CAMPAIGN_FIELD_CELL = "grid content-start gap-1.5 min-w-0";

/** Label caption: uppercase, small and tracked so all labels read as one family. */
export const CAMPAIGN_CAPTION_CLASS = "text-[11px] font-semibold uppercase tracking-[0.08em] text-bo-muted";
/** Short helper copy under a control. */
export const CAMPAIGN_HELPER_CLASS = "text-[11px] leading-snug text-bo-faint";

type FieldProps = HTMLAttributes<HTMLElement> & {
  label: React.ReactNode;
  children: React.ReactNode;
  /** Optional copy under the control (why the field exists, units, limits). */
  helper?: React.ReactNode;
  /** Rendered as a div when the control already carries its own label. */
  as?: "label" | "div";
  className?: string;
  "data-testid"?: string;
};

/** One labelled field cell: caption + control + helper, always the same gaps. */
export function CampaignField({ label, children, helper, as = "label", className, "data-testid": testId, ...rest }: FieldProps) {
  const Tag = as;
  return (
    <Tag className={cn(CAMPAIGN_FIELD_CELL, className)} data-testid={testId} data-observe={testId} {...rest}>
      <span className={CAMPAIGN_CAPTION_CLASS}>{label}</span>
      {children}
      {helper ? <span className={CAMPAIGN_HELPER_CLASS}>{helper}</span> : null}
    </Tag>
  );
}

/** Bare field cell for controls that paint their own label (counters). */
export function CampaignFieldCell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(CAMPAIGN_FIELD_CELL, className)}>{children}</div>;
}

/** Status copy + badge tone per campaign status (draft / sending / sent). */
export const CAMPAIGN_STATUS_UI: Record<Campaign["status"], { label: string; variant: "neutral" | "warning" | "success" }> = {
  draft: { label: "Borrador", variant: "neutral" },
  sending: { label: "Enviando", variant: "warning" },
  sent: { label: "Enviada", variant: "success" },
};

export function campaignStatusLabel(status?: Campaign["status"]): string {
  return (status && CAMPAIGN_STATUS_UI[status]?.label) || "Borrador";
}

/** Status chip reused by the list cards and the editor header. */
export function CampaignStatusBadge({ status, testId }: { status?: Campaign["status"]; testId: string }) {
  const ui = (status && CAMPAIGN_STATUS_UI[status]) || CAMPAIGN_STATUS_UI.draft;
  return (
    <StatusBadge variant={ui.variant} size="sm" data-testid={testId} data-observe={testId}>
      {ui.label}
    </StatusBadge>
  );
}

export const CAMPAIGN_CHANNEL_UI: Record<CampaignChannel, { label: string }> = {
  email: { label: "Email" },
  whatsapp: { label: "WhatsApp" },
};

/** Audience summary in words, so a card explains who it will reach. */
export function campaignAudienceSummary(audience: Campaign["audience"], days: number, manualCount: number): string {
  if (audience === "manual") return `${manualCount} contacto${manualCount === 1 ? "" : "s"} manuales`;
  return `Reservas de los ultimos ${days} dias`;
}

const DAY_MS = 86_400_000;

/**
 * Relative Spanish date ("hoy", "ayer", "hace 5 dias"). `now` is injected so
 * the output stays deterministic for a given campaign snapshot.
 */
export function campaignRelativeDate(value: string | undefined, now: number = Date.now()): string {
  if (!value) return "";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const days = Math.floor((now - time) / DAY_MS);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} dias`;
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `hace ${months} mes${months === 1 ? "" : "es"}`;
  }
  const years = Math.floor(days / 365);
  return `hace ${years} ano${years === 1 ? "" : "s"}`;
}

/** Absolute fallback for a card footer: "12 mar 2025". */
export function campaignShortDate(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

type SectionCardProps = HTMLAttributes<HTMLDivElement> & {
  icon: React.ReactNode;
  title: string;
  helper?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  "data-testid": string;
};

/**
 * A settings/content section: icon chip, title and one line of helper copy.
 * Built on the shared Panel so surface, radius and shadow stay on brand.
 */
export function CampaignSection({
  icon,
  title,
  helper,
  actions,
  className,
  bodyClassName,
  children,
  "data-testid": testId,
  ...rest
}: SectionCardProps) {
  return (
    <Panel
      className={className}
      bodyClassName={bodyClassName}
      data-testid={testId}
      data-observe={testId}
      title={
        <span className="flex items-center gap-2">
          <span
            className="grid size-7 shrink-0 place-items-center rounded-bo-sm border border-bo-border-2 bg-bo-surface-2 text-bo-accent"
            aria-hidden="true"
            data-observe={testId ? `${testId}-icon` : undefined}
          >
            {icon}
          </span>
          {title}
        </span>
      }
      meta={helper}
      actions={actions}
      {...rest}
    >
      {children}
    </Panel>
  );
}
