import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import type { CalendarDay } from "../../api/types";
import { parseISODate } from "../lib/format";
import { cn } from "../shadcn/utils";
import { MonthCalendar } from "./MonthCalendar";

type Pos = { top: number; left: number };

type MonthCalendarDatePickerProps = {
  value: string;
  onChange: (iso: string) => void;
  year: number;
  month: number; // 1..12
  days: CalendarDay[];
  onPrevMonth: () => void;
  onNextMonth: () => void;
  loading?: boolean;
  disabled?: boolean;
  popoverOffsetX?: number;
  id?: string;
  className?: string;
  "data-testid"?: string;
};

function portalEl(): HTMLElement | null {
  return document.getElementById("bo-portal") || document.body;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatDateLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const yyyy = Number(m[1]), mm = Number(m[2]), dd = Number(m[3]);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return iso;
  return new Date(yyyy, mm - 1, dd).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Header date picker for the table map. Renders the same trigger button as the
 * generic DatePicker but opens a popover with the full MonthCalendar (booking
 * occupancy per day, open/closed lock, occupancy tones), matching the calendar
 * used on /app/reservas.
 */
export function MonthCalendarDatePicker({
  value,
  onChange,
  year,
  month,
  days,
  onPrevMonth,
  onNextMonth,
  loading = false,
  disabled = false,
  popoverOffsetX = 0,
  id,
  className,
  "data-testid": dataTestId,
}: MonthCalendarDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);
  const selected = useMemo(() => parseISODate(value) ?? new Date(), [value]);

  // The button is rendered by SSR with the calendar icon, but the
  // `onClick` handler is only attached after React has hydrated on the
  // client. Without a hint, a fast click in the first ~2s on the dev
  // server (or any slow connection in prod) silently does nothing. Track
  // hydration explicitly so we can show a loading state and disable the
  // button until it's actually wired up.
  useEffect(() => {
    setHydrated(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Popover is responsive + square (width: min(344px, 95vw); aspect-ratio 1/1),
    // so derive its on-screen footprint from the viewport instead of the old
    // fixed 360x400 guesses — otherwise the clamp lets it overflow narrow screens.
    const popW = Math.min(344, vw * 0.95);
    const popH = popW; // square popover
    const spaceBelow = vh - r.bottom - 8;
    const top = spaceBelow < popH ? Math.max(8, r.top - 8 - popH) : r.bottom + 8;
    // Center the popover's horizontal axis on the trigger button (r.left + r.width/2
    // is the button's center, popW/2 is the popover's). popoverOffsetX remains a
    // fine-adjust on top of centering. Clamp keeps it on-screen on narrow viewports.
    const left = clamp(r.left + r.width / 2 - popW / 2 + popoverOffsetX, 8, vw - popW - 8);
    setPos({ top, left });
  }, [open, popoverOffsetX]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((v) => !v);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    // Use composedPath() to walk up the event's full path (including text nodes
    // and shadow DOM). Ref-based contains() races with React's portal
    // re-renders: the popover can briefly unmount between the user clicking
    // a control inside it and React flushing the new state, so the listener
    // would close the popover. composedPath is the stable signal.
    const pathContainsPopover = (ev: Event) => {
      const path = ev.composedPath();
      for (const node of path) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.getAttribute("data-ui") === "date-picker-popover") return true;
      }
      return false;
    };
    const onDown = (ev: PointerEvent) => {
      if (pathContainsPopover(ev)) return;
      if (btnRef.current?.contains(ev.target as Node)) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  const handleSelectDate = useCallback(
    (iso: string) => {
      onChange(iso);
      close();
    },
    [close, onChange],
  );

  const pop = open && pos && root ? (
    createPortal(
      <AnimatePresence>
        <motion.div
          ref={popRef}
          className="bo-datePop bo-datePop--glass bo-datePop--mcal"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          style={{ top: pos.top, left: pos.left }}
          role="dialog"
          aria-label="Calendario"
          data-ui="date-picker-popover"
        >
          <MonthCalendar
            year={year}
            month={month}
            days={days}
            selectedDateISO={value}
            onSelectDate={handleSelectDate}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            loading={loading}
          />
        </motion.div>
      </AnimatePresence>,
      root,
    )
  ) : null;

  return (
    <>
      <button
        id={id}
        ref={btnRef}
        className={cn("bo-dateBtn bo-dateBtn--glass", className, !hydrated && "is-loading")}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Select date"
        aria-disabled={disabled || !hydrated}
        disabled={disabled || !hydrated}
        data-ui="date-picker-btn"
        data-hydrated={hydrated ? "true" : "false"}
        data-testid={dataTestId}
      >
        <CalendarDays size={18} strokeWidth={1.8} />
        <span className="bo-dateBtnLabel" data-slot="datePicker-dateBtnLabel">{formatDateLabel(value)}</span>
        {hydrated ? null : (
          <span className="bo-dateBtnSpinner" aria-hidden="true" data-slot="date-picker-spinner" />
        )}
      </button>
      {pop}
    </>
  );
}
