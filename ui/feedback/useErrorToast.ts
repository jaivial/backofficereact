import { useCallback, useEffect, useRef } from "react";

import { useToasts } from "./useToasts";

type ErrorToastController = {
  show: (message?: string | null) => void;
  handleError: (error: unknown, fallbackMessage?: string) => void;
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

  const handleError = useCallback((errorValue: unknown, fallbackMessage = "Error inesperado") => {
    if (errorValue instanceof Error && errorValue.message.trim() !== "") {
      show(errorValue.message);
      return;
    }
    if (typeof errorValue === "string" && errorValue.trim() !== "") {
      show(errorValue);
      return;
    }
    show(fallbackMessage);
  }, [show]);

  return { show, handleError };
}
