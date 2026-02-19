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
    <div className="bo-toastWrap" aria-label="Notifications" aria-live="polite">
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
          >
            <div className="bo-toastTitle">{t.title}</div>
            {t.message ? <div className="bo-toastMsg">{t.message}</div> : null}
            <button className="bo-toastX" type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss">
              ×
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
