import React from "react";
import { Minus, Plus } from "lucide-react";

interface ConfigDayManagerProps {
  dailyLimit: { limit: number; totalPeople: number; freeBookingSeats: number } | null;
  day: { isOpen: boolean } | null;
  busy: boolean;
  draftLimit: string;
  reduceMotion: boolean;
  dayVisibilityTransition: { duration: number } | { duration: number; ease: "easeInOut" };
  onToggleDay: () => void;
  onStep: (step: number) => void;
  onDraftChange: (value: string) => void;
  onDraftSave: () => void;
}

export function ConfigDayManager({
  dailyLimit,
  day,
  busy,
  draftLimit,
  reduceMotion,
  dayVisibilityTransition,
  onToggleDay,
  onStep,
  onDraftChange,
  onDraftSave,
}: ConfigDayManagerProps) {
  if (!dailyLimit) return null;

  return (
    <div
      data-ui="config-daily-limit-panel"
      className="bo-dailyLimitPanel !shadow-md !w-fit p-4 px-8 bo-panel mx-auto"
      style={reduceMotion ? { opacity: 1 } : {}}
    >
      <div data-slot="panel-head" className="bo-panelHead !pt-0 !w-fit !mx-auto">
        <div data-role="title" className="bo-panelTitle !text-center" data-ui="daily-limit-title">Límite diario</div>
      </div>
      <div data-slot="daily-limit-body" className="bo-dailyLimitBody">
        <div data-ui="limit-counter" className="bo-dailyLimitCounter justify-center items-center flex !flex-row !gap-4">
          <button
            data-action="decrement"
            className="bo-counterBtn"
            type="button"
            onClick={() => onStep(-1)}
            disabled={busy || Number(draftLimit || 0) <= 0}
            aria-label="Reducir límite diario"
            data-ui="decrement-btn"
          >
            <Minus size={14} strokeWidth={2.2} data-ui="decrement-icon" />
          </button>
          <input
            data-role="limit-input"
            className="bo-input bo-input--sm bo-counterInput bo-configLimitInput"
            value={draftLimit}
            inputMode="numeric"
            onChange={(e) => onDraftChange(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={onDraftSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
            }}
            data-ui="limit-input"
          />
          <button
            data-action="increment"
            className="bo-counterBtn"
            type="button"
            onClick={() => onStep(1)}
            disabled={busy || Number(draftLimit || 0) >= 500}
            aria-label="Aumentar límite diario"
            data-ui="increment-btn"
          >
            <Plus size={14} strokeWidth={2.2} data-ui="increment-icon" />
          </button>
        </div>
        <div data-ui="free-seats" className="bo-mutedText pt-4 !w-fit !mx-auto" data-slot="free-seats-label">Libres: {dailyLimit.freeBookingSeats}</div>
      </div>
    </div>
  );
}
