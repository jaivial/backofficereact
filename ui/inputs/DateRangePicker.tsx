import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "../shadcn/utils";

import { RangeCalendar, sortedRange, useRangeCalendar } from "./RangeCalendar";

type Pos = { top: number; left: number };
type Placement = "bottom" | "top";

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  buttonLabel?: string;
  ariaLabel?: string;
  className?: string;
  popoverOffsetX?: number;
  disabled?: boolean;
};

function portalEl(): HTMLElement | null {
  return document.getElementById("bo-portal") || document.body;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function formatRangeLabel(from: string, to: string): string {
  const fmt = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return "";
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return "";
    return new Date(yyyy, mm - 1, dd).toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  if (!from && !to) return "Rango personalizado";
  if (!from) return "Rango personalizado";
  const fromText = fmt(from);
  if (!fromText) return "Rango personalizado";
  if (!to) return `Desde ${fromText}`;
  const toText = fmt(to);
  if (!toText) return `Desde ${fromText}`;
  if (from === to) return fromText;
  return `${fromText} - ${toText}`;
}

export function DateRangePicker({
  from,
  to,
  onChange,
  buttonLabel = "Rango personalizado",
  ariaLabel,
  className,
  popoverOffsetX = 0,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [placement, setPlacement] = useState<Placement>("bottom");

  const { draft, viewYear, viewMonth0, prevMonth, nextMonth, selectDay, clear: clearDraft, resetTo } =
    useRangeCalendar({ from, to });

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    resetTo({ from, to });
  }, [from, open, resetTo, to]);

  const reposition = useCallback(() => {
    const el = btnRef.current;
    if (!open || !el) return;

    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popRect = popRef.current?.getBoundingClientRect();
    const popW = popRect?.width ?? 312;
    const popH = popRect?.height ?? 380;

    const left = clamp(r.left + popoverOffsetX, 8, vw - popW - 8);
    const spaceBelow = vh - r.bottom - 8;
    const nextPlacement: Placement = spaceBelow < popH ? "top" : "bottom";
    const top = nextPlacement === "top" ? Math.max(8, r.top - 8 - popH) : r.bottom + 8;

    setPlacement((curr) => (curr === nextPlacement ? curr : nextPlacement));
    setPos((curr) => {
      if (curr && curr.top === top && curr.left === left) return curr;
      return { top, left };
    });
  }, [open, popoverOffsetX]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useLayoutEffect(() => {
    if (!open) return;
    if (!popRef.current) return;
    reposition();
  }, [draft.from, draft.to, open, reposition, viewMonth0, viewYear]);

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

  const apply = useCallback(() => {
    const normalized = sortedRange(draft.from, draft.to || draft.from);
    onChange(normalized);
    close();
  }, [close, draft.from, draft.to, onChange]);

  const clear = useCallback(() => {
    clearDraft();
    onChange({ from: "", to: "" });
    close();
  }, [clearDraft, close, onChange]);

  const canApply = Boolean(draft.from);
  const label = useMemo(() => formatRangeLabel(from, to), [from, to]);

  const pop = open && pos && root ? (
    createPortal(
      <AnimatePresence>
        <motion.div
          ref={popRef}
          className="bo-datePop bo-dateRangePop bo-datePop--glass"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: placement === "top" ? -6 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: placement === "top" ? -6 : 6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          style={{ top: pos.top, left: pos.left }}
          role="dialog"
          aria-label="Selector de rango de fechas"
          data-ui="date-range-picker-popover"
        >
          <RangeCalendar
            draft={draft}
            viewYear={viewYear}
            viewMonth0={viewMonth0}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
            onSelectDay={selectDay}
            uiPrefix="date-range-picker"
          />
          <div className="bo-dateRangeActions" data-ui="date-range-picker-actions">
            <button type="button" className="bo-btn bo-btn--sm bo-btn--ghost" onClick={clear} data-ui="date-range-picker-clear-btn">
              Limpiar
            </button>
            <button type="button" className="bo-btn bo-btn--sm bo-btn--primary" onClick={apply} disabled={!canApply} data-ui="date-range-picker-apply-btn">
              Aplicar
            </button>
          </div>
        </motion.div>
      </AnimatePresence>,
      root,
    )
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        className={cn("bo-dateBtn bo-dateBtn--glass bo-dateRangeBtn", className)}
        type="button"
        onClick={toggle}
        aria-label={ariaLabel || buttonLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
        data-testid="date-range-picker-btn"
      >
        <Calendar size={16} strokeWidth={1.8} />
        <span className="bo-dateBtnLabel" data-slot="dateRangePicker-dateBtnLabel">{label || buttonLabel}</span>
      </button>
      {pop}
    </>
  );
}
