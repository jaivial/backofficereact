import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { cn } from "../shadcn/utils";
import { POSCashDayCalendar } from "./POSCashDayCalendar";

type Pos = { top: number; left: number };

type POSCashDayDatePickerProps = {
  value: string;
  onChange: (iso: string) => void;
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
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Date picker for the POS, showing per day whether the till was open or sealed
 * and what it took. Same popover shell as MonthCalendarDatePicker so both
 * calendars sit identically on screen.
 */
export function POSCashDayDatePicker({
  value,
  onChange,
  disabled = false,
  popoverOffsetX = 0,
  id,
  className,
  "data-testid": dataTestId,
}: POSCashDayDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const reduceMotion = useReducedMotion();
  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);

  // The month on show follows the selected day until the user navigates away
  // from it, so reopening the picker never lands on a month nobody asked for.
  const initialMonth = useMemo(() => {
    const m = value.match(/^(\d{4})-(\d{2})-\d{2}$/);
    const now = new Date();
    return m ? { year: Number(m[1]), month: Number(m[2]) } : { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [value]);
  const [view, setView] = useState(initialMonth);
  useEffect(() => { setView(initialMonth); }, [initialMonth]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Taller than the reservations popover: the cash cells carry two lines of
    // detail, so a six-week month needs about 415px.
    const popH = 440;
    const spaceBelow = window.innerHeight - r.bottom - 8;
    setPos({
      top: spaceBelow < popH ? Math.max(8, r.top - 8 - popH) : r.bottom + 8,
      left: clamp(r.left + popoverOffsetX, 8, window.innerWidth - 344 - 8),
    });
  }, [open, popoverOffsetX]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((v) => !v);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    // composedPath() rather than ref.contains(): the popover can briefly
    // unmount between a click inside it and React flushing the new state, and
    // a contains() check would read that as a click outside and close it.
    const pathContainsPopover = (ev: Event) => {
      for (const node of ev.composedPath()) {
        if (node instanceof HTMLElement && node.getAttribute("data-ui") === "date-picker-popover") return true;
      }
      return false;
    };
    const onDown = (ev: PointerEvent) => {
      if (pathContainsPopover(ev)) return;
      if (btnRef.current?.contains(ev.target as Node)) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") close(); };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  const handleSelectDate = useCallback((iso: string) => {
    onChange(iso);
    close();
  }, [close, onChange]);

  const prevMonth = useCallback(() => {
    setView((v) => (v.month === 1 ? { year: v.year - 1, month: 12 } : { year: v.year, month: v.month - 1 }));
  }, []);
  const nextMonth = useCallback(() => {
    setView((v) => (v.month === 12 ? { year: v.year + 1, month: 1 } : { year: v.year, month: v.month + 1 }));
  }, []);

  const pop = open && pos && root ? createPortal(
    <AnimatePresence>
      <motion.div
        className="bo-datePop bo-datePop--glass bo-datePop--mcal"
        initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-label="Calendario de caja"
        data-ui="date-picker-popover"
      >
        <POSCashDayCalendar
          year={view.year}
          month={view.month}
          selectedDateISO={value}
          onSelectDate={handleSelectDate}
          onPrevMonth={prevMonth}
          onNextMonth={nextMonth}
        />
      </motion.div>
    </AnimatePresence>,
    root,
  ) : null;

  return (
    <>
      <button
        id={id}
        ref={btnRef}
        className={cn("bo-dateBtn bo-dateBtn--glass", className)}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Elegir día de caja"
        aria-disabled={disabled}
        disabled={disabled}
        data-ui="date-picker-btn"
        data-testid={dataTestId}
      >
        <CalendarDays size={18} strokeWidth={1.8} />
        <span className="bo-dateBtnLabel" data-slot="posCashDayPicker-dateBtnLabel">{formatDateLabel(value)}</span>
      </button>
      {pop}
    </>
  );
}
