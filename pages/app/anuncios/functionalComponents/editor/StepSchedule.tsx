import React from "react";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { Segmented } from "../../../../../ui/htmlBuilder/BuilderInspector";
import { cn } from "../../../../../ui/shadcn/utils";
import { stepShownOn, todayMadrid, type StepSchedule } from "./adDesign";

/*
 * Dates of one card of a multiple ad (ads_html_editor_v1): «Como el anuncio»
 * (no dates: the card is shown whenever the ad is) or «Entre fechas» (only
 * between them, inside the dates of the ad). Used in the «Tarjetas»
 * inspector section and in Ajustes.
 */

export type DateRange = { starts_at: string | null; ends_at: string | null };

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** One line about the card today: shown, not yet, or over. */
export function stepStatus(schedule: StepSchedule, today = todayMadrid()): { shown: boolean; text: string } {
  if (!schedule.starts_at || !schedule.ends_at) return { shown: true, text: "Sigue las fechas del anuncio" };
  if (stepShownOn(schedule, today)) return { shown: true, text: `Se ve hasta el ${shortDate(schedule.ends_at)}` };
  if (today < schedule.starts_at) return { shown: false, text: `Oculta hasta el ${shortDate(schedule.starts_at)}` };
  return { shown: false, text: `Terminó el ${shortDate(schedule.ends_at)}` };
}

/** Short badge of a page chip ("hasta 24 dic", "terminada"). */
export function stepBadge(schedule: StepSchedule, today = todayMadrid()): string {
  if (!schedule.starts_at || !schedule.ends_at) return "";
  if (today > schedule.ends_at) return "terminada";
  if (today < schedule.starts_at) return `desde ${new Date(`${schedule.starts_at}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
  return `hasta ${new Date(`${schedule.ends_at}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
}

/** A card dated outside the dates of the ad is only shown where both overlap. */
function outsideAd(schedule: StepSchedule, ad: DateRange): boolean {
  if (!schedule.starts_at || !schedule.ends_at || !ad.starts_at || !ad.ends_at) return false;
  return schedule.starts_at < ad.starts_at || schedule.ends_at > ad.ends_at;
}

export function StepScheduleControl({
  schedule,
  adRange,
  onChange,
  testId,
  compact = false,
}: {
  schedule: StepSchedule;
  adRange: DateRange;
  onChange: (next: StepSchedule) => void;
  testId: string;
  compact?: boolean;
}) {
  const dated = Boolean(schedule.starts_at && schedule.ends_at);
  const status = stepStatus(schedule);
  const input = cn("bo-input min-w-0", compact ? "h-8 px-2 text-[12px]" : "h-10");
  return (
    <div className="grid gap-1.5" data-testid={testId}>
      <Segmented<"ad" | "range">
        label="Fechas de la tarjeta"
        value={dated ? "range" : "ad"}
        onChange={(v) => {
          if (v === "ad") onChange({ starts_at: null, ends_at: null });
          else {
            const today = todayMadrid();
            const start = adRange.starts_at && adRange.starts_at > today ? adRange.starts_at : today;
            const end = adRange.ends_at && adRange.ends_at >= start ? adRange.ends_at : start;
            onChange({ starts_at: start, ends_at: end });
          }
        }}
        options={[
          { value: "ad", label: "Como el anuncio", title: "La tarjeta se ve siempre que se vea el anuncio" },
          { value: "range", label: "Entre fechas", title: "La tarjeta solo se ve entre estas fechas" },
        ]}
        testId={`${testId}-mode`}
      />
      {dated && (
        <div className={cn("grid items-center gap-1.5", compact ? "grid-cols-[auto_1fr]" : "grid-cols-[1fr_auto_1fr]")} data-testid={`${testId}-dates`}>
          {compact && <span className="text-[11px] text-bo-muted" data-testid={`${testId}-from`}>Desde</span>}
          <input
            type="date"
            className={input}
            value={schedule.starts_at ?? ""}
            max={schedule.ends_at ?? undefined}
            aria-label="La tarjeta se ve desde"
            onChange={(e) => e.currentTarget.value && onChange({ ...schedule, starts_at: e.currentTarget.value })}
            data-testid={`${testId}-starts`}
          />
          <span className="text-[11px] text-bo-muted" data-testid={`${testId}-sep`}>{compact ? "Hasta" : "a"}</span>
          <input
            type="date"
            className={input}
            value={schedule.ends_at ?? ""}
            min={schedule.starts_at ?? undefined}
            aria-label="La tarjeta se ve hasta"
            onChange={(e) => e.currentTarget.value && onChange({ ...schedule, ends_at: e.currentTarget.value })}
            data-testid={`${testId}-ends`}
          />
        </div>
      )}
      <span
        className={cn("inline-flex items-center gap-1 text-[11px] leading-snug", status.shown ? "text-bo-faint" : "text-[var(--bo-on-surface-warning)]")}
        data-testid={`${testId}-status`}
        data-shown={status.shown}
      >
        <CalendarClock size={12} aria-hidden="true" data-testid={`${testId}-status-icon`} />
        {status.text}
      </span>
      {outsideAd(schedule, adRange) && (
        <span className="inline-flex items-start gap-1 text-[11px] leading-snug text-[var(--bo-on-surface-warning)]" data-testid={`${testId}-outside`}>
          <TriangleAlert size={12} className="mt-px shrink-0" aria-hidden="true" data-testid={`${testId}-outside-icon`} />
          Se sale de las fechas del anuncio: fuera de ellas tampoco se verá.
        </span>
      )}
    </div>
  );
}
