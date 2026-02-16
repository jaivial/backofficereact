import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock3 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Pos = { top: number; left: number; width: number };

function portalEl(): HTMLElement | null {
  return document.getElementById("bo-portal") || document.body;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildTimes(stepMinutes: number): string[] {
  const step = Number.isFinite(stepMinutes) && stepMinutes > 0 ? Math.max(1, Math.floor(stepMinutes)) : 5;
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) {
      out.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return out;
}

function normalizeHHMM(v: string): string {
  const s = String(v || "").trim();
  if (!s) return "";
  if (/^\\d{2}:\\d{2}$/.test(s)) return s;
  if (/^\\d{2}:\\d{2}:\\d{2}$/.test(s)) return s.slice(0, 5);
  return s.length >= 5 ? s.slice(0, 5) : "";
}

export function TimePicker({
  value,
  onChange,
  stepMinutes,
  ariaLabel,
}: {
  value: string;
  onChange: (hhmm: string) => void;
  stepMinutes?: number;
  ariaLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);

  const times = useMemo(() => buildTimes(stepMinutes ?? 5), [stepMinutes]);
  const selected = useMemo(() => normalizeHHMM(value), [value]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useLayoutEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.max(180, r.width);
    const top = r.bottom + 8;
    const left = clamp(r.left, 8, vw - width - 8);
    setPos({ top, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, times.findIndex((t) => t === selected));
    setActiveIdx(idx >= 0 ? idx : 0);
  }, [open, selected, times]);

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (btnRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
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

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-opt=\"${activeIdx}\"]`);
    el?.focus();
    el?.scrollIntoView?.({ block: "nearest" });
  }, [activeIdx, open]);

  const onBtnKey = useCallback((ev: React.KeyboardEvent) => {
    if (ev.key === "ArrowDown" || ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      setOpen(true);
    }
  }, []);

  const onListKey = useCallback(
    (ev: React.KeyboardEvent) => {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setActiveIdx((i) => Math.min(times.length - 1, i + 1));
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        const opt = times[activeIdx];
        if (opt) onChange(opt);
        close();
        btnRef.current?.focus();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        close();
        btnRef.current?.focus();
      }
    },
    [activeIdx, close, onChange, times],
  );

  const list = open && pos && root ? (
    createPortal(
      <AnimatePresence>
        <motion.div
          ref={listRef}
          className="bo-selectList bo-timeList"
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKey}
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {times.map((t, idx) => {
            const isSel = t === selected;
            const isAct = idx === activeIdx;
            return (
              <button
                key={t}
                type="button"
                className={`bo-selectItem${isSel ? " is-selected" : ""}${isAct ? " is-active" : ""}`}
                role="option"
                aria-selected={isSel}
                tabIndex={idx === activeIdx ? 0 : -1}
                data-opt={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  onChange(t);
                  close();
                  btnRef.current?.focus();
                }}
              >
                {t}
              </button>
            );
          })}
        </motion.div>,
      </AnimatePresence>,
      root,
    )
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        className="bo-dateBtn"
        type="button"
        aria-label={ariaLabel || "Select time"}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onBtnKey}
      >
        <Clock3 size={18} strokeWidth={1.8} aria-hidden="true" />
        <span className="bo-dateBtnLabel">{selected || "—:—"}</span>
      </button>
      {list}
    </>
  );
}

