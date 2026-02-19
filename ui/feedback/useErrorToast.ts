import { useCallback, useEffect, useRef } from "react";

import { useToasts } from "./useToasts";

type ErrorToastController = {
  show: (message?: string | null) => void;
};

export function useErrorToast(error?: string | null, title = "Error"): ErrorToastController {
  const { pushToast } = useToasts();
  const lastMessageRef = useRef<string>("");

  const show = useCallback((message?: string | null) => {
    const msg = String(message ?? "").trim();
    if (!msg) return;
    if (lastMessageRef.current === msg) return;
    lastMessageRef.current = msg;
    pushToast({ kind: "error", title, message: msg });
  }, [pushToast, title]);

  useEffect(() => {
    show(error);
  }, [error, show]);

  useEffect(() => {
    if (error) return;
    lastMessageRef.current = "";
  }, [error]);

  return { show };
}
