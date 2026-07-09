import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "../shadcn/utils";

type Option = { value: string; label: string; icon?: React.ReactNode };

export function SearchableSelect({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
  disabled,
  menuMinWidthPx,
  "data-testid": dataTestId,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  ariaLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  menuMinWidthPx?: number;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const reduceMotion = useReducedMotion();

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);

  useEffect(() => {
    if (!open) return;
    // Focus the search input when the menu opens.
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    const onDown = (ev: PointerEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;
      if (wrapperRef.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [open, close]);

  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const maxHeight = 320;
  const minWidth = typeof menuMinWidthPx === "number" ? menuMinWidthPx : 220;

  useEffect(() => {
    if (!open) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const opensUp = spaceBelow < maxHeight && rect.top > spaceBelow;
    setPos({
      top: opensUp ? rect.top - maxHeight - 6 : rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, minWidth),
    });
  }, [open, minWidth]);

  const label = selected?.label ?? placeholder ?? "Selecciona...";

  return (
    <div ref={wrapperRef} className="bo-selectWrapper" data-ui="searchable-select-wrapper">
      <button
        ref={btnRef}
        className={cn("bo-selectBtn", className)}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpen((v) => !v);
        }}
        data-role="searchable-select-trigger"
        data-testid={dataTestId}
      >
        <span className="bo-selectLabelWrap" data-ui="select-label-wrap">
          {selected?.icon ? (
            <span className="bo-selectIcon" aria-hidden="true">{selected.icon}</span>
          ) : null}
          <span className={cn("bo-selectLabel !max-w-[240px]", !selected && "text-[var(--bo-muted)]")} data-ui="select-selected-label">
            {label}
          </span>
        </span>
        <ChevronDown size={16} strokeWidth={1.8} className="bo-selectChev" aria-hidden="true" />
      </button>

      {typeof window !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={listRef}
                className="bo-selectList"
                role="listbox"
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  top: `${pos.top}px`,
                  left: `${pos.left}px`,
                  width: `${pos.width}px`,
                  maxHeight: `${maxHeight}px`,
                  display: "flex",
                  flexDirection: "column",
                }}
                data-ui="searchable-select-listbox"
              >
                <div className="flex items-center gap-2 px-2 py-2 border-b border-[var(--bo-border)] sticky top-0 bg-[var(--bo-surface)]">
                  <Search size={14} className="text-[var(--bo-muted)] shrink-0" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); btnRef.current?.focus(); } }}
                    placeholder={searchPlaceholder ?? "Buscar..."}
                    className="w-full bg-transparent outline-none text-sm text-[var(--bo-text)]"
                    data-role="searchable-select-search"
                    aria-label="Buscar"
                  />
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: `${maxHeight - 46}px` }}>
                  {filtered.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-[var(--bo-muted)]" data-role="searchable-select-empty">
                      {emptyText ?? "Sin resultados"}
                    </div>
                  ) : (
                    filtered.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        className={cn("bo-selectItem", o.value === value && "is-selected")}
                        role="option"
                        aria-selected={o.value === value}
                        onClick={() => { onChange(o.value); close(); btnRef.current?.focus(); }}
                        data-role="searchable-select-option"
                      >
                        {o.icon ? <span className="bo-selectItemIcon" aria-hidden="true">{o.icon}</span> : null}
                        <span data-ui="select-item-label">{o.label}</span>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
