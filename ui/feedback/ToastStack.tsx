import React, { useEffect } from "react";
import { useAtomValue } from "jotai";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { toastsAtom } from "../../state/atoms";
import { useToasts } from "./useToasts";
import { cn } from "../shadcn/utils";

export function ToastStack({
  className,
}: {
  className?: string;
}) {
  const toasts = useAtomValue(toastsAtom);
  const { dismissToast } = useToasts();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const now = Date.now();
    const timers = toasts.map((t) => {
      const elapsed = now - t.createdAt;
      const remaining = Math.max(0, t.timeoutMs - elapsed);
      return window.setTimeout(() => dismissToast(t.id), remaining);
    });
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [dismissToast, toasts]);

  return (
    <div className={cn("bo-toastWrap", className)} aria-label="Notifications" aria-live="polite" data-ui="toast-stack">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`bo-toast bo-toast--glass bo-toast--${t.kind}`}
            initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
            role="status"
            data-ui="toast"
            data-kind={t.kind}
          >
            <div className="bo-toastTitle" data-ui="toast-title">{t.title}</div>
            {t.message ? <div className="bo-toastMsg" data-ui="toast-message">{t.message}</div> : null}
            <button className="bo-toastX" type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" data-ui="toast-dismiss-btn">
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
