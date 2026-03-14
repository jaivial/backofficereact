import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { formatISODate, parseISODate } from "../lib/format";

type Pos = { top: number; left: number };
type DatePickerProps = {
  value: string;
  onChange: (iso: string) => void;
  popoverOffsetX?: number;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  id?: string;
};

function portalEl(): HTMLElement | null {
  return document.getElementById("portal") || document.body;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function monthLabel(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0, 1));
  return d.toLocaleString("es-ES", { month: "long", year: "numeric" });
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

export function DatePicker({ value, onChange, popoverOffsetX = 0, disabled = false, minDate, maxDate, id }: DatePickerProps) {
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
    const top = r.bottom + 8;
    const left = clamp(r.left + popoverOffsetX, 8, vw - 280 - 8);
    setPos({ top, left });
  }, [open, popoverOffsetX]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    if (disabled) return;
    setOpen((v) => !v);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
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
          className="fixed z-[9999] w-[280px] rounded-xl border border-border bg-gradient-to-b from-white/[0.04] to-black/[0.10] bg-card shadow-soft p-3 border-primary/30 bg-primary/[0.12] bg-secondary/80 backdrop-blur-md"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 1.5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 1.5 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          style={{ top: pos.top, left: pos.left }}
          role="dialog"
          aria-label="Calendar"
        >
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <button
              type="button"
              className="w-9 h-9 rounded-xl border border-border bg-white/[0.02] text-muted-foreground grid place-items-center cursor-pointer transition-all hover:bg-white/[0.04] hover:-translate-y-0.5 hover:text-foreground border-primary/30 bg-primary/20"
              onClick={prevMonth}
              aria-label="Prev month"
            >
              <ChevronLeft size={18} strokeWidth={1.8} />
            </button>
            <div className="text-xs font-bold text-foreground capitalize">{monthLabel(viewYear, viewMonth0)}</div>
            <button
              type="button"
              className="w-9 h-9 rounded-xl border border-border bg-white/[0.02] text-muted-foreground grid place-items-center cursor-pointer transition-all hover:bg-white/[0.04] hover:-translate-y-0.5 hover:text-foreground border-primary/30 bg-primary/20"
              onClick={nextMonth}
              aria-label="Next month"
            >
              <ChevronRight size={18} strokeWidth={1.8} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1" aria-hidden="true">
            <div>L</div>
            <div>M</div>
            <div>M</div>
            <div>J</div>
            <div>V</div>
            <div>S</div>
            <div>D</div>
          </div>
          <div className="grid grid-cols-7 gap-1" aria-label="Calendar grid">
            {grid.map((c, idx) => {
              if (!c.day || !c.iso) return <div key={idx} className="w-[30px] h-[30px] cursor-default hover:bg-transparent" aria-hidden="true" />;
              const iso = c.iso;
              const isSelected = iso === selectedISO;
              const cls = isSelected ? "bg-primary/40 border border-primary/50 shadow-[0_10px_24px_rgba(185,168,255,0.18)] text-foreground" : "";
              const isBeforeMin = Boolean(minDate && iso < minDate);
              const isAfterMax = Boolean(maxDate && iso > maxDate);
              const isDisabled = isBeforeMin || isAfterMax;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`w-[30px] h-[30px] rounded-full grid place-items-center transition-colors border-0 bg-transparent cursor-pointer text-sm hover:bg-white/[0.03] ${cls} ${isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    onChange(iso);
                    close();
                  }}
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
        className="h-9 rounded-xl border border-border bg-white/[0.02] text-foreground px-3 cursor-pointer inline-flex items-center gap-2.5 border-primary/30 bg-primary/20"
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Select date"
        aria-disabled={disabled}
        disabled={disabled}
      >
        <CalendarDays size={18} strokeWidth={1.8} />
        <span className="text-xs font-bold">{value}</span>
      </button>
      {pop}
    </>
  );
}
