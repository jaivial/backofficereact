import { useCallback } from "react";
import { useAtom } from "jotai";

import { toastsAtom, type Toast, type ToastKind } from "../../state/atoms";

function uid(): string {
  return "t_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useToasts() {
  const [toasts, setToasts] = useAtom(toastsAtom);

  type ToastInput = { kind: ToastKind; title: string; message?: string; timeoutMs?: number };

  const pushToast = useCallback(
    (input: ToastInput | string, legacyKind: ToastKind = "info") => {
      const t: ToastInput = typeof input === "string"
        ? { kind: legacyKind, title: input }
        : input;
      const toast: Toast = {
        id: uid(),
        kind: t.kind,
        title: t.title,
        message: t.message,
        createdAt: Date.now(),
        timeoutMs: t.timeoutMs ?? 3200,
      };
      setToasts((prev) => [...prev, toast]);
      return toast.id;
    },
    [setToasts],
  );

  const dismissToast = useCallback(
    (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [setToasts],
  );

  return { toasts, pushToast, dismissToast };
}
