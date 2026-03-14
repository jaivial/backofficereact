import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { formatISODate, parseISODate } from "../lib/format";

type Pos = { top: number; left: number };
type Placement = "bottom" | "top";

type DateDropdownProps = {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  id?: string;
  daysBefore?: number;
  daysAfter?: number;
};

function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function portalEl(): HTMLElement | null {
  return document.getElementById("portal") || document.body;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function monthLabel(year: number, month0: number): string {
  const date = new Date(Date.UTC(year, month0, 1));
  return date.toLocaleString("es-ES", { month: "long", year: "numeric" });
}

function buildMonthGrid(year: number, month0: number) {
  const first = new Date(Date.UTC(year, month0, 1));
  const firstDow = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < firstDow; i += 1) cells.push({ day: null, iso: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, iso: formatISODate(new Date(Date.UTC(year, month0, day))) });
  }
  return cells;
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function DateDropdown({
  value,
  onChange,
  disabled = false,
  id,
  daysBefore = 7,
  daysAfter = 60,
}: DateDropdownProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [placement, setPlacement] = useState<Placement>("bottom");
  const reduceMotion = useReducedMotion();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);

  const today = useMemo(() => todayUTC(), []);
  const minDate = useMemo(() => formatISODate(addDays(today, -daysBefore)), [daysBefore, today]);
  const maxDate = useMemo(() => formatISODate(addDays(today, daysAfter)), [daysAfter, today]);
  const selected = useMemo(() => parseISODate(value) ?? today, [today, value]);
  const [viewYear, setViewYear] = useState(selected.getUTCFullYear());
  const [viewMonth0, setViewMonth0] = useState(selected.getUTCMonth());
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth0), [viewMonth0, viewYear]);
  const label = useMemo(() => formatDateLabel(value), [value]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(
    (ev?: React.MouseEvent) => {
      ev?.stopPropagation();
      if (disabled) return;
      setOpen((v) => !v);
    },
    [disabled],
  );

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    setViewYear(selected.getUTCFullYear());
    setViewMonth0(selected.getUTCMonth());
  }, [open, selected]);

  const reposition = useCallback(() => {
    const anchor = btnRef.current || wrapperRef.current;
    if (!open || !anchor) return;

    const rect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popRect = popRef.current?.getBoundingClientRect();
    const popW = popRect?.width ?? 280;
    const popH = popRect?.height ?? 320;
    const left = clamp(rect.left, 8, vw - popW - 8);
    const spaceBelow = vh - rect.bottom - 8;
    const nextPlacement: Placement = spaceBelow < popH && rect.top > spaceBelow ? "top" : "bottom";
    const top = nextPlacement === "top" ? Math.max(8, rect.top - 8 - popH) : rect.bottom + 8;

    setPlacement((current) => (current === nextPlacement ? current : nextPlacement));
    setPos((current) => {
      if (current && current.top === top && current.left === left) return current;
      return { top, left };
    });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useLayoutEffect(() => {
    if (!open || !popRef.current) return;
    reposition();
  }, [open, reposition, viewMonth0, viewYear]);

  useEffect(() => {
    if (!open) return;
    const onReflow = () => reposition();
    window.addEventListener("resize", onReflow, { passive: true });
    window.addEventListener("scroll", onReflow, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (wrapperRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  const onBtnKey = useCallback(
    (ev: React.KeyboardEvent) => {
      if (disabled) return;
      if (ev.key === "ArrowDown" || ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        setOpen(true);
      }
    },
    [disabled],
  );

  const prevMonth = useCallback(() => {
    setViewMonth0((month0) => {
      if (month0 === 0) {
        setViewYear((year) => year - 1);
        return 11;
      }
      return month0 - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth0((month0) => {
      if (month0 === 11) {
        setViewYear((year) => year + 1);
        return 0;
      }
      return month0 + 1;
    });
  }, []);

  const pop = open && pos && root ? createPortal(
    <AnimatePresence>
      <motion.div
        ref={popRef}
        className="fixed z-[9999] w-[280px] rounded-xl border border-border bg-gradient-to-b from-white/[0.04] to-black/[0.10] bg-card shadow-soft p-3 border-primary/30 bg-primary/[0.12] bg-secondary/80 backdrop-blur-md"
        initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: placement === "top" ? -1.5 : 1.5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: placement === "top" ? -1.5 : 1.5 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-label="Seleccionar fecha"
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <button
            type="button"
            className="w-9 h-9 rounded-xl border border-border bg-white/[0.02] text-muted-foreground grid place-items-center cursor-pointer transition-all hover:bg-white/[0.04] hover:-translate-y-0.5 hover:text-foreground border-primary/30 bg-primary/20"
            onClick={prevMonth}
            aria-label="Mes anterior"
          >
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
          <div className="text-xs font-bold text-foreground capitalize">{monthLabel(viewYear, viewMonth0)}</div>
          <button
            type="button"
            className="w-9 h-9 rounded-xl border border-border bg-white/[0.02] text-muted-foreground grid place-items-center cursor-pointer transition-all hover:bg-white/[0.04] hover:-translate-y-0.5 hover:text-foreground border-primary/30 bg-primary/20"
            onClick={nextMonth}
            aria-label="Mes siguiente"
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
        <div className="grid grid-cols-7 gap-1" aria-label="Calendario">
          {grid.map((cell, index) => {
            if (!cell.day || !cell.iso) {
              return <div key={index} className="w-[30px] h-[30px] cursor-default hover:bg-transparent" aria-hidden="true" />;
            }

            const iso = cell.iso;
            const isSelected = iso === value;
            const isDisabled = iso < minDate || iso > maxDate;
            return (
              <button
                key={iso}
                type="button"
                className={`w-[30px] h-[30px] rounded-full grid place-items-center transition-colors border-0 bg-transparent cursor-pointer text-sm hover:bg-white/[0.03] ${isSelected ? "bg-primary/40 border border-primary/50 shadow-[0_10px_24px_rgba(185,168,255,0.18)] text-foreground" : ""} ${isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}
                disabled={isDisabled}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(iso);
                  close();
                  btnRef.current?.focus();
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>,
    root,
  ) : null;

  return (
    <>
      <div ref={wrapperRef} className="relative" style={{ minWidth: 180 }}>
        <button
          id={id}
          ref={btnRef}
          className="h-9 rounded-xl border border-border bg-white/[0.02] text-foreground px-3 cursor-pointer inline-flex items-center gap-2.5 w-full justify-between border-primary/30 bg-primary/20"
          type="button"
          aria-label="Seleccionar fecha"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={toggle}
          onKeyDown={onBtnKey}
          data-ui="date-dropdown-btn"
        >
          <div className="flex items-center gap-2.5">
            <Calendar size={18} strokeWidth={1.8} />
            <span className="text-xs font-bold">{label}</span>
          </div>
          <ChevronDown size={16} strokeWidth={1.8} className="text-muted-foreground" aria-hidden="true" />
        </button>
      </div>
      {pop}
    </>
  );
}
