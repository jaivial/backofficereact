import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Option = { value: string; label: string };
type Pos = { top: number; left: number; width: number };

function portalEl(): HTMLElement | null {
  return document.getElementById("bo-portal") || document.body;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function Select({
  value,
  onChange,
  options,
  size,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const reduceMotion = useReducedMotion();

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const root = useMemo(() => (typeof document !== "undefined" ? portalEl() : null), []);

  const selected = useMemo(() => options.find((o) => o.value === value) || options[0], [options, value]);
  const btnClass = size === "sm" ? "bo-selectBtn bo-selectBtn--sm" : "bo-selectBtn";

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
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setActiveIdx(idx);
  }, [open, options, value]);

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

  const onBtnKey = useCallback(
    (ev: React.KeyboardEvent) => {
      if (ev.key === "ArrowDown" || ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        setOpen(true);
      }
    },
    [],
  );

  const onListKey = useCallback(
    (ev: React.KeyboardEvent) => {
      if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setActiveIdx((i) => Math.min(options.length - 1, i + 1));
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (ev.key === "Enter") {
        ev.preventDefault();
        const opt = options[activeIdx];
        if (opt) onChange(opt.value);
        close();
        btnRef.current?.focus();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        close();
        btnRef.current?.focus();
      }
    },
    [activeIdx, close, onChange, options],
  );

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-opt="${activeIdx}"]`);
    el?.focus();
  }, [activeIdx, open]);

  const list = open && pos && root ? (
    createPortal(
      <AnimatePresence>
        <motion.div
          ref={listRef}
          className="bo-selectList"
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKey}
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {options.map((o, idx) => {
            const isSel = o.value === value;
            const isAct = idx === activeIdx;
            return (
              <button
                key={o.value}
                type="button"
                className={`bo-selectItem${isSel ? " is-selected" : ""}${isAct ? " is-active" : ""}`}
                role="option"
                aria-selected={isSel}
                tabIndex={idx === activeIdx ? 0 : -1}
                data-opt={idx}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => {
                  onChange(o.value);
                  close();
                  btnRef.current?.focus();
                }}
              >
                {o.label}
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
        className={btnClass}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onBtnKey}
      >
        <span className="bo-selectLabel">{selected?.label ?? ""}</span>
        <ChevronDown size={16} strokeWidth={1.8} className="bo-selectChev" aria-hidden="true" />
      </button>
      {list}
    </>
  );
}
