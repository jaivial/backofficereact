import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

function portalEl(): HTMLElement | null {
  return document.getElementById("bo-portal") || document.body;
}

function useFocusRestore(open: boolean) {
  const prev = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      prev.current = document.activeElement as HTMLElement | null;
      return;
    }
    prev.current?.focus?.();
    prev.current = null;
  }, [open]);
}

export function Modal({
  open,
  title,
  onClose,
  children,
  widthPx,
  size,
  className,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  widthPx?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  useFocusRestore(open);
  const reduceMotion = useReducedMotion();
  const sizeWidth =
    size === "sm" ? 460 :
    size === "md" ? 640 :
    size === "lg" ? 840 :
    undefined;
  const resolvedWidth = widthPx ?? sizeWidth;

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (typeof document === "undefined") return null;
  const root = portalEl();
  if (!root) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="bo-modalOverlay"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className={["bo-modal", "bo-modal--glass", className].filter(Boolean).join(" ")}
            role="dialog"
            aria-label={title}
            style={
              resolvedWidth
                ? ({ ["--bo-modal-w" as any]: `${resolvedWidth}px` } as React.CSSProperties)
                : undefined
            }
            initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    root,
  );
}
