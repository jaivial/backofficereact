import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

import { cn } from "../../../../ui/shadcn/utils";

/** How long each kind stays up. Errors linger, since they may need reading twice. */
const TIMEOUTS = { success: 2600, info: 3400, error: 7000 } as const;

export type POSToastKind = keyof typeof TIMEOUTS;

export type POSToastInput = {
  kind?: POSToastKind;
  title: string;
  message?: string;
  timeoutMs?: number;
};

export type POSToast = POSToastInput & { id: string; kind: POSToastKind; createdAt: number };

type ToastApi = {
  /** Show a toast and return its id, so a caller can dismiss it early. */
  push: (input: POSToastInput) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

/**
 * Exported so `usePOSRegister` can raise a toast when a provider is mounted
 * and quietly fall back to plain state when it is not.
 */
export const POSToastContext = createContext<ToastApi | null>(null);

/**
 * Toasts for the POS. Reusable and self-contained: it owns its own state and
 * renders through a portal, so a toast is never clipped by the sell screen's
 * scroll containers and is unaffected by where the caller sits in the tree.
 *
 * Success and error replace any earlier toast of the same kind. On a till the
 * operator does one thing at a time, so a stack of stale confirmations is
 * noise; the newest state of each kind is the only one worth showing.
 */
export function POSToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<POSToast[]>([]);
  const timers = useRef(new Map<string, number>());
  // document.body does not exist during SSR; portal only after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: string) => {
    const handle = timers.current.get(id);
    if (handle) window.clearTimeout(handle);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((input: POSToastInput) => {
    const kind = input.kind ?? "info";
    const id = `pos_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.filter((t) => t.kind !== kind), { ...input, id, kind, createdAt: Date.now() }]);
    return id;
  }, []);

  const clear = useCallback(() => {
    for (const handle of timers.current.values()) window.clearTimeout(handle);
    timers.current.clear();
    setToasts([]);
  }, []);

  // One timer per toast id, started when it appears. Ids are unique, so this
  // runs once per toast rather than on every render. The bookkeeping matters:
  // when a same-kind toast replaces an earlier one the old id disappears from
  // state while its handle is still pending, so the drop below has to clear the
  // handle *and* forget it, or the map grows for the life of the page.
  useEffect(() => {
    const pending = timers.current;
    const live = new Set(toasts.map((toast) => toast.id));
    for (const toast of toasts) {
      if (pending.has(toast.id)) continue;
      const timeout = toast.timeoutMs ?? TIMEOUTS[toast.kind];
      if (timeout <= 0) continue;
      pending.set(toast.id, window.setTimeout(() => {
        pending.delete(toast.id);
        dismiss(toast.id);
      }, timeout));
    }
    for (const [id, handle] of pending) {
      if (live.has(id)) continue;
      window.clearTimeout(handle);
      pending.delete(id);
    }
  }, [dismiss, toasts]);

  // A separate unmount-only effect: the effect above is not a teardown hook,
  // it reconciles timers with state on every change.
  useEffect(() => () => {
    for (const handle of timers.current.values()) window.clearTimeout(handle);
    timers.current.clear();
  }, []);

  const api = useMemo<ToastApi>(() => ({
    push,
    success: (title, message) => push({ kind: "success", title, message }),
    error: (title, message) => push({ kind: "error", title, message }),
    info: (title, message) => push({ kind: "info", title, message }),
    dismiss,
    clear,
  }), [clear, dismiss, push]);

  return (
    <POSToastContext.Provider value={api}>
      {children}
      {mounted ? createPortal(<POSToastStack toasts={toasts} onDismiss={dismiss} />, document.body) : null}
    </POSToastContext.Provider>
  );
}

export function usePOSToast(): ToastApi {
  const api = useContext(POSToastContext);
  if (!api) throw new Error("usePOSToast must be used inside <POSToastProvider>");
  return api;
}

const ICONS: Record<POSToastKind, typeof Info> = { success: CheckCircle2, error: AlertCircle, info: Info };

function POSToastStack({ toasts, onDismiss }: { toasts: POSToast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="posToast__wrap"
      role="region"
      aria-label="Notificaciones del TPV"
      data-ui="pos-toast-wrap"
      data-testid="pos-toast-wrap"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.kind];
        return (
          <div
            key={toast.id}
            className={cn("posToast", `posToast--${toast.kind}`)}
            role={toast.kind === "error" ? "alert" : "status"}
            aria-live={toast.kind === "error" ? "assertive" : "polite"}
            data-ui="pos-toast"
            data-kind={toast.kind}
            data-testid={`pos-toast-${toast.id}`}
          >
            <span className="posToast__icon" data-ui="pos-toast-icon" aria-hidden="true">
              <Icon size={18} strokeWidth={1.8} />
            </span>
            <div className="posToast__body">
              <p className="posToast__title" data-ui="pos-toast-title">{toast.title}</p>
              {toast.message ? <p className="posToast__message" data-ui="pos-toast-message">{toast.message}</p> : null}
            </div>
            <button
              type="button"
              className="posToast__close"
              onClick={() => onDismiss(toast.id)}
              aria-label="Cerrar aviso"
              data-ui="pos-toast-close"
              data-testid={`pos-toast-close-${toast.id}`}
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
