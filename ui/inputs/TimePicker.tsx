import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
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
  const [activeIdx, setActiveIdx] = useState(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const times = useMemo(() => buildTimes(stepMinutes ?? 5), [stepMinutes]);
  const selected = useMemo(() => normalizeHHMM(value), [value]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

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
      if (wrapperRef.current?.contains(t)) return;
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
    const el = listRef.current?.querySelector<HTMLElement>(`[data-opt="${activeIdx}"]`);
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

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={btnRef}
        className="h-10 px-3 rounded-lg border border-white/[0.06] bg-white/[0.03] text-foreground flex items-center gap-2 transition-colors duration-150 hover:bg-white/[0.06] hover:border-white/[0.12] focus:outline-none focus:border-primary/40"
        type="button"
        aria-label={ariaLabel || "Select time"}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onBtnKey}
      >
        <Clock3 size={18} strokeWidth={1.8} aria-hidden="true" />
        <span className="text-sm">{selected || "—:—"}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={listRef}
            className="absolute z-50 mt-1 p-1 rounded-lg border border-white/[0.06] bg-card shadow-lg min-w-[120px] max-h-[200px] overflow-auto"
            role="listbox"
            tabIndex={-1}
            onKeyDown={onListKey}
            initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          >
            {times.map((t, idx) => {
              const isSel = t === selected;
              const isAct = idx === activeIdx;
              return (
                <button
                  key={t}
                  type="button"
                  className={`w-full px-3 py-2 rounded-md text-sm text-left text-foreground flex items-center gap-2 transition-colors duration-150 hover:bg-white/[0.06] cursor-pointer ${isSel ? "bg-primary/12 text-primary" : ""} ${isAct ? "bg-white/[0.04]" : ""}`}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
