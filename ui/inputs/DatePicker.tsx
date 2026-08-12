import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { formatISODate, parseISODate } from "../lib/format";
import { cn } from "../shadcn/utils";

type Pos = { top: number; left: number };
type DatePickerProps = {
  value: string;
  onChange: (iso: string) => void;
  popoverOffsetX?: number;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
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

function monthLabel(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0, 1));
  return d.toLocaleString("es-ES", { month: "long", year: "numeric" });
}

function formatDateLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const yyyy = Number(m[1]), mm = Number(m[2]), dd = Number(m[3]);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return iso;
  return new Date(yyyy, mm - 1, dd).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function buildMonthGrid(year: number, month0: number) {
  // Week starts Monday.
  const first = new Date(Date.UTC(year, month0, 1));
  const firstDow = (first.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = formatISODate(new Date(Date.UTC(year, month0, d)));
    cells.push({ day: d, iso });
  }
  return cells;
}

export function DatePicker({ value, onChange, popoverOffsetX = 0, disabled = false, minDate, maxDate, id, className, "data-testid": dataTestId }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const reduceMotion = useReducedMotion();
  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);

  const selected = useMemo(() => parseISODate(value) ?? new Date(), [value]);
  const [viewYear, setViewYear] = useState(selected.getUTCFullYear());
  const [viewMonth0, setViewMonth0] = useState(selected.getUTCMonth());

  useEffect(() => {
    if (!open) return;
    setViewYear(selected.getUTCFullYear());
    setViewMonth0(selected.getUTCMonth());
  }, [open, selected]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popW = Math.min(320, vw - 16);
    const popH = 320;
    const spaceBelow = vh - r.bottom - 8;
    const top = spaceBelow < popH ? Math.max(8, r.top - 8 - popH) : r.bottom + 8;
    const left = clamp(r.left + popoverOffsetX, 8, vw - popW - 8);
    setPos({ top, left });
  }, [open, popoverOffsetX]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((v) => !v);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
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

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth0), [viewMonth0, viewYear]);
  const selectedISO = value;

  const prevMonth = useCallback(() => {
    setViewMonth0((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setViewMonth0((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const pop = open && pos && root ? (
    createPortal(
      <AnimatePresence>
        <motion.div
          ref={popRef}
          className="bo-datePop bo-datePop--glass"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          style={{ top: pos.top, left: pos.left }}
          role="dialog"
          aria-label="Calendar"
          data-ui="date-picker-popover"
        >
          <div className="bo-dateHead" data-ui="date-picker-header">
            <button
              type="button"
              className="bo-actionBtn bo-actionBtn--glass"
              onClick={prevMonth}
              aria-label="Prev month"
              data-ui="date-picker-prev-btn"
            >
              <ChevronLeft size={18} strokeWidth={1.8} />
            </button>
            <div className="bo-dateTitle" data-ui="date-picker-month-label">{monthLabel(viewYear, viewMonth0)}</div>
            <button
              type="button"
              className="bo-actionBtn bo-actionBtn--glass"
              onClick={nextMonth}
              aria-label="Next month"
              data-ui="date-picker-next-btn"
            >
              <ChevronRight size={18} strokeWidth={1.8} />
            </button>
          </div>
          <div className="bo-calDows" aria-hidden="true" data-ui="date-picker-weekdays" data-slot="date-picker-weekdays">
            <div data-ui="date-picker-weekday" data-slot="date-picker-weekday">L</div>
            <div data-ui="date-picker-weekday" data-slot="date-picker-weekday">M</div>
            <div data-ui="date-picker-weekday" data-slot="date-picker-weekday">M</div>
            <div data-ui="date-picker-weekday" data-slot="date-picker-weekday">J</div>
            <div data-ui="date-picker-weekday" data-slot="date-picker-weekday">V</div>
            <div data-ui="date-picker-weekday" data-slot="date-picker-weekday">S</div>
            <div data-ui="date-picker-weekday" data-slot="date-picker-weekday">D</div>
          </div>
          <div className="bo-calGrid" aria-label="Calendar grid" data-ui="date-picker-grid" data-slot="date-picker-calendar-grid">
            {grid.map((c, idx) => {
              if (!c.day || !c.iso) return <div key={idx} className="bo-calDay bo-calDay--empty" aria-hidden="true" data-ui="date-picker-empty-cell" data-slot="date-picker-empty-cell" />;
              const iso = c.iso;
              const isSelected = iso === selectedISO;
              const isBeforeMin = Boolean(minDate && iso < minDate);
              const isAfterMax = Boolean(maxDate && iso > maxDate);
              const isDisabled = isBeforeMin || isAfterMax;
              return (
                <button
                  key={iso}
                  type="button"
                  className={cn("bo-calDay", isSelected && "is-selected", isDisabled && "is-disabled")}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onChange(iso);
                    close();
                  }}
                  data-ui="date-picker-day"
                  data-date={iso}
                  data-selected={isSelected ? "true" : "false"}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
        </motion.div>,
      </AnimatePresence>,
      root,
    )
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
        aria-label="Select date"
        aria-disabled={disabled}
        disabled={disabled}
        data-ui="date-picker-btn"
        data-testid={dataTestId}
      >
        <CalendarDays size={18} strokeWidth={1.8} />
        <span className="bo-dateBtnLabel" data-slot="datePicker-dateBtnLabel">{formatDateLabel(value)}</span>
      </button>
      {pop}
    </>
  );
}
