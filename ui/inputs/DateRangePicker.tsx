import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { formatISODate, parseISODate } from "../lib/format";

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

type RangeDraft = {
  from: string;
  to: string;
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

function buildMonthGrid(year: number, month0: number) {
  const first = new Date(Date.UTC(year, month0, 1));
  const firstDow = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: formatISODate(new Date(Date.UTC(year, month0, d))) });
  }
  return cells;
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

function sortedRange(from: string, to: string): RangeDraft {
  if (!from) return { from: "", to: "" };
  if (!to) return { from, to: "" };
  if (to < from) return { from: to, to: from };
  return { from, to };
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
  const [draft, setDraft] = useState<RangeDraft>(() => sortedRange(from, to));

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);
  const reduceMotion = useReducedMotion();

  const anchorDate = useMemo(() => parseISODate(from) ?? new Date(), [from]);
  const [viewYear, setViewYear] = useState(anchorDate.getUTCFullYear());
  const [viewMonth0, setViewMonth0] = useState(anchorDate.getUTCMonth());

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    const next = sortedRange(from, to);
    setDraft(next);
    const focusDate = parseISODate(next.from) ?? new Date();
    setViewYear(focusDate.getUTCFullYear());
    setViewMonth0(focusDate.getUTCMonth());
  }, [from, open, to]);

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

  const onSelectDay = useCallback((iso: string) => {
    setDraft((curr) => {
      if (!curr.from || curr.to) return { from: iso, to: "" };
      if (iso < curr.from) return { from: iso, to: curr.from };
      return { from: curr.from, to: iso };
    });
  }, []);

  const apply = useCallback(() => {
    const normalized = sortedRange(draft.from, draft.to || draft.from);
    onChange(normalized);
    close();
  }, [close, draft.from, draft.to, onChange]);

  const clear = useCallback(() => {
    setDraft({ from: "", to: "" });
    onChange({ from: "", to: "" });
    close();
  }, [close, onChange]);

  const hasDraft = Boolean(draft.from);
  const canApply = Boolean(draft.from);
  const fromISO = draft.from;
  const toISO = draft.to || draft.from;
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth0), [viewMonth0, viewYear]);
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
        >
          <div className="bo-dateHead">
            <button type="button" className="bo-actionBtn bo-actionBtn--glass" onClick={prevMonth} aria-label="Mes anterior">
              <ChevronLeft size={18} strokeWidth={1.8} />
            </button>
            <div className="bo-dateTitle">{monthLabel(viewYear, viewMonth0)}</div>
            <button type="button" className="bo-actionBtn bo-actionBtn--glass" onClick={nextMonth} aria-label="Mes siguiente">
              <ChevronRight size={18} strokeWidth={1.8} />
            </button>
          </div>
          <div className="bo-calDows" aria-hidden="true">
            <div>L</div>
            <div>M</div>
            <div>M</div>
            <div>J</div>
            <div>V</div>
            <div>S</div>
            <div>D</div>
          </div>
          <div className="bo-calGrid" aria-label="Calendario de rango">
            {grid.map((c, idx) => {
              if (!c.day || !c.iso) return <div key={idx} className="bo-calDay bo-calDay--empty" aria-hidden="true" />;
              const iso = c.iso;
              const isStart = hasDraft && iso === fromISO;
              const isEnd = hasDraft && iso === toISO;
              const isInRange = hasDraft && iso > fromISO && iso < toISO;
              const cls = [
                "bo-calDay",
                isInRange ? "is-inRange" : "",
                isStart ? "is-rangeStart" : "",
                isEnd ? "is-rangeEnd" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button key={iso} type="button" className={cls} onClick={() => onSelectDay(iso)}>
                  {c.day}
                </button>
              );
            })}
          </div>
          <div className="bo-dateRangeActions">
            <button type="button" className="bo-btn bo-btn--sm bo-btn--ghost" onClick={clear}>
              Limpiar
            </button>
            <button type="button" className="bo-btn bo-btn--sm bo-btn--primary" onClick={apply} disabled={!canApply}>
              Aplicar
            </button>
          </div>
        </motion.div>,
      </AnimatePresence>,
      root,
    )
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        className={["bo-dateBtn bo-dateBtn--glass bo-dateRangeBtn", className].filter(Boolean).join(" ")}
        type="button"
        onClick={toggle}
        aria-label={ariaLabel || buttonLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={disabled}
      >
        <Calendar size={16} strokeWidth={1.8} />
        <span className="bo-dateBtnLabel">{label || buttonLabel}</span>
      </button>
      {pop}
    </>
  );
}
