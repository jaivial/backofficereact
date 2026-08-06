import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ScrollArea } from "../layout/ScrollArea";
import { cn } from "../shadcn/utils";

type Option = { value: string; label: string; icon?: React.ReactNode };

export function Select({
  value,
  onChange,
  options,
  size,
  ariaLabel,
  placeholder,
  className,
  style,
  disabled,
  listMaxHeightPx,
  menuMinWidthPx,
  listClassName,
  "data-testid": dataTestId,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  size?: "sm" | "md";
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  listMaxHeightPx?: number;
  menuMinWidthPx?: number;
  listClassName?: string;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"up" | "down">("down");
  const [activeIdx, setActiveIdx] = useState(0);
  const reduceMotion = useReducedMotion();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? (placeholder ? undefined : options[0]),
    [options, placeholder, value],
  );
  const btnClass = size === "sm" ? "bo-selectBtn bo-selectBtn--sm" : "bo-selectBtn";

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
      if (listRef.current?.contains(t)) return;
      close();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") close();
    };
    const onScroll = (ev: Event) => {
      if (listRef.current?.contains(ev.target as Node)) return;
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("scroll", onScroll, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
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
  const contentEstimate = options.length * 44 + 16;
  const listHeight = Math.min(maxHeight, contentEstimate);
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

    const width = Math.min(Math.max(rect.width, minWidth), Math.max(160, window.innerWidth - 16));
    const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - width - 8));
    setListPosition({
      top: opensUp ? rect.top - desiredHeight - 6 : rect.bottom + 6,
      left,
      width,
    });
    setDirection(opensUp ? "up" : "down");
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setActiveIdx(idx);
  }, [listMaxHeightPx, maxHeight, minWidth, open, options, value]);

  return (
    <div ref={wrapperRef} className="bo-selectWrapper" style={style} data-ui="select-wrapper">
      <button
        ref={btnRef}
        className={cn(btnClass, className)}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={onBtnKey}
        data-role="select-trigger"
        data-testid={dataTestId}
      >
        <span className="bo-selectLabelWrap" data-ui="select-label-wrap">
          {selected?.icon ? (
            <span className="bo-selectIcon" aria-hidden="true" data-ui="select-selected-icon">
              {selected.icon}
            </span>
          ) : null}
          <span className="bo-selectLabel" data-ui="select-selected-label">{selected?.label ?? placeholder ?? ""}</span>
        </span>
        <ChevronDown size={16} strokeWidth={1.8} className="bo-selectChev" aria-hidden="true" />
      </button>
      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={listRef}
                className={cn("bo-selectList", direction === "up" && "bo-selectList--up", listClassName)}
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
                  height: `${listHeight}px`,
                }}
                data-ui="select-listbox"
              >
                <ScrollArea dataSlot="select-list-scroll">
                  <div className="grid gap-0.5">
                    {options.map((o, idx) => {
                      const isSel = o.value === value;
                      const isAct = idx === activeIdx;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          className={cn("bo-selectItem", isSel && "is-selected", isAct && "is-active")}
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
                          data-role="select-option"
                        >
                          {o.icon ? (
                            <span className="bo-selectItemIcon" aria-hidden="true" data-ui="select-item-icon">
                              {o.icon}
                            </span>
                          ) : null}
                          <span data-ui="select-item-label">{o.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
