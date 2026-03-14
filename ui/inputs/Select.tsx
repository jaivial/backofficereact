import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

type Option = { value: string; label: string; icon?: React.ReactNode };

export function Select({
  value,
  onChange,
  options,
  size,
  ariaLabel,
  className,
  style,
  disabled,
  listMaxHeightPx,
  menuMinWidthPx,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  size?: "sm" | "md";
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  listMaxHeightPx?: number;
  menuMinWidthPx?: number;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [activeIdx, setActiveIdx] = useState(0);
  const reduceMotion = useReducedMotion();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) || options[0], [options, value]);
  const btnClass = size === "sm" 
    ? "h-8 px-3 rounded-lg border border-white/[0.06] bg-white/[0.03] text-sm text-foreground flex items-center justify-between gap-2 w-full min-w-[140px] transition-colors duration-150 hover:bg-white/[0.06] hover:border-white/[0.12] focus:outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)] disabled:opacity-50 disabled:cursor-not-allowed"
    : "h-10 px-3 rounded-lg border border-white/[0.06] bg-white/[0.03] text-foreground flex items-center justify-between gap-2 w-full min-w-[180px] transition-colors duration-150 hover:bg-white/[0.06] hover:border-white/[0.12] focus:outline-none focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)] disabled:opacity-50 disabled:cursor-not-allowed";

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
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (wrapperRef.current?.contains(t)) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    const onScroll = () => {
      close();
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, { capture: true });
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

  const maxHeight = typeof listMaxHeightPx === "number" ? listMaxHeightPx : Math.min(320, options.length * 44 + 12);
  const minWidth = typeof menuMinWidthPx === "number" ? menuMinWidthPx : 180;

  const [listPosition, setListPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;
    const desiredHeight = maxHeight;
    const opensUp = spaceBelow < desiredHeight && spaceAbove > spaceBelow;

    setListPosition({
      top: opensUp ? rect.top - desiredHeight - 6 : rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, minWidth),
    });
    setDirection(opensUp ? "up" : "down");
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setActiveIdx(idx);
  }, [listMaxHeightPx, maxHeight, minWidth, open, options, value]);

  return (
    <div ref={wrapperRef} className="relative" style={style}>
      <button
        ref={btnRef}
        className={[btnClass, className].filter(Boolean).join(" ")}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onBtnKey}
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {selected?.icon ? (
            <span className="text-muted" aria-hidden="true">
              {selected.icon}
            </span>
          ) : null}
          <span className="text-sm truncate">{selected?.label ?? ""}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.8} className="text-muted w-4 h-4 flex-shrink-0" aria-hidden="true" />
      </button>
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={listRef}
                className={`absolute z-50 mt-1 p-1 rounded-lg border border-white/[0.06] bg-card shadow-lg overflow-auto min-w-[180px] ${direction === "up" ? "bottom-full mb-1" : ""}`}
                role="listbox"
                tabIndex={-1}
                onKeyDown={onListKey}
                initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: direction === "up" ? 6 : -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: direction === "up" ? 6 : -6 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  top: `${listPosition.top}px`,
                  left: `${listPosition.left}px`,
                  width: `${listPosition.width}px`,
                  maxHeight: `${maxHeight}px`,
                }}
              >
                {options.map((o, idx) => {
                  const isSel = o.value === value;
                  const isAct = idx === activeIdx;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={`w-full px-3 py-2 rounded-md text-sm text-left text-foreground flex items-center gap-2 transition-colors duration-150 hover:bg-white/[0.06] cursor-pointer ${isSel ? "bg-primary/12 text-primary" : ""} ${isAct ? "bg-white/[0.04]" : ""}`}
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
                      {o.icon ? (
                        <span className="text-muted w-4 h-4 flex-shrink-0" aria-hidden="true">
                          {o.icon}
                        </span>
                      ) : null}
                      <span>{o.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
