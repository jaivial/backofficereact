import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { formatISODate, parseISODate } from "../lib/format";
import { cn } from "../shadcn/utils";
import {
  DATE_DROPDOWN_MARGIN,
  DATE_DROPDOWN_POPOVER_HEIGHT,
  DATE_DROPDOWN_POPOVER_WIDTH,
} from "./constants/dateDropdown";
import { calculatePopoverPosition, clamp, type Pos } from "./hooks/usePopoverPosition";
import type { Placement } from "./constants/dateDropdown";

type DateDropdownProps = {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  id?: string;
  daysBefore?: number;
  daysAfter?: number;
  className?: string;
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
  return document.getElementById("bo-portal") || document.body;
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
  className,
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
    const { pos: newPos, placement: newPlacement } = calculatePopoverPosition(
      anchor,
      popRef.current,
      DATE_DROPDOWN_POPOVER_WIDTH,
      DATE_DROPDOWN_POPOVER_HEIGHT,
      DATE_DROPDOWN_MARGIN,
    );
    setPlacement((current) => (current === newPlacement ? current : newPlacement));
    setPos((current) => {
      if (current && current.top === newPos.top && current.left === newPos.left) return current;
      return newPos;
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
        className="bo-datePop bo-datePop--glass"
        initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: placement === "top" ? -6 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: placement === "top" ? -6 : 6 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
        style={{ top: pos.top, left: pos.left }}
        role="dialog"
        aria-label="Seleccionar fecha"
        data-ui="date-dropdown-popover"
      >
        <div className="bo-dateHead" data-ui="date-dropdown-header">
          <button
            type="button"
            className="bo-actionBtn bo-actionBtn--glass"
            onClick={prevMonth}
            aria-label="Mes anterior"
            data-ui="date-dropdown-prev-btn"
          >
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
          <div className="bo-dateTitle" data-ui="date-dropdown-month-label">{monthLabel(viewYear, viewMonth0)}</div>
          <button
            type="button"
            className="bo-actionBtn bo-actionBtn--glass"
            onClick={nextMonth}
            aria-label="Mes siguiente"
            data-ui="date-dropdown-next-btn"
          >
            <ChevronRight size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div className="bo-calDows" aria-hidden="true" data-ui="date-dropdown-weekdays" data-slot="date-dropdown-weekdays">
          <div data-ui="date-dropdown-weekday" data-slot="date-dropdown-weekday">L</div>
          <div data-ui="date-dropdown-weekday" data-slot="date-dropdown-weekday">M</div>
          <div data-ui="date-dropdown-weekday" data-slot="date-dropdown-weekday">M</div>
          <div data-ui="date-dropdown-weekday" data-slot="date-dropdown-weekday">J</div>
          <div data-ui="date-dropdown-weekday" data-slot="date-dropdown-weekday">V</div>
          <div data-ui="date-dropdown-weekday" data-slot="date-dropdown-weekday">S</div>
          <div data-ui="date-dropdown-weekday" data-slot="date-dropdown-weekday">D</div>
        </div>
        <div className="bo-calGrid" aria-label="Calendario" data-ui="date-dropdown-grid" data-slot="date-dropdown-calendar-grid">
          {grid.map((cell, index) => {
            if (!cell.day || !cell.iso) {
              return <div key={index} className="bo-calDay bo-calDay--empty" aria-hidden="true" data-ui="date-dropdown-empty-cell" data-slot="date-dropdown-empty-cell" />;
            }

            const iso = cell.iso;
            const isSelected = iso === value;
            const isDisabled = iso < minDate || iso > maxDate;
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
                  btnRef.current?.focus();
                }}
                data-ui="date-dropdown-day"
                data-date={iso}
                data-selected={isSelected ? "true" : "false"}
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
      <div ref={wrapperRef} className={cn("bo-selectWrapper", className)} style={{ minWidth: 180 }} data-ui="date-dropdown-wrapper">
        <button
          id={id}
          ref={btnRef}
          className="bo-dateBtn bo-dateBtn--glass"
          type="button"
          aria-label="Seleccionar fecha"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={toggle}
          onKeyDown={onBtnKey}
          data-ui="date-dropdown-btn"
        >
          <Calendar size={18} strokeWidth={1.8} />
          <span className="bo-dateBtnLabel" data-slot="dateDropdown-dateBtnLabel">{label}</span>
          <ChevronDown size={16} strokeWidth={1.8} className="bo-selectChev" aria-hidden="true" />
        </button>
      </div>
      {pop}
    </>
  );
}
