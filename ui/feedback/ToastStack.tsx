import React, { useEffect } from "react";
import { useAtomValue } from "jotai";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { toastsAtom } from "../../state/atoms";
import { useToasts } from "./useToasts";

export function ToastStack() {
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
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2" aria-label="Notifications" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const variantClass = {
            info: "border-white/[0.06] bg-white/[0.02]",
            success: "border-success/30 bg-success/10",
            warning: "border-warning/30 bg-warning/10",
            error: "border-danger/30 bg-danger/10",
          }[t.kind] || "border-white/[0.06] bg-white/[0.02]";
          
          return (
            <motion.div
              key={t.id}
              className={`relative flex items-start gap-3 p-4 rounded-lg border ${variantClass} shadow-lg`}
              initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
              role="status"
            >
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">{t.title}</div>
                {t.message ? <div className="text-sm text-muted mt-0.5">{t.message}</div> : null}
              </div>
              <button className="text-muted hover:text-foreground text-lg leading-none" type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
                ×
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
