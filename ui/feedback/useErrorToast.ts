import { useEffect, useRef } from "react";

import { useToasts } from "./useToasts";

export function useErrorToast(error: string | null | undefined, title = "Error") {
  const { pushToast } = useToasts();
  const lastMessageRef = useRef<string>("");

  useEffect(() => {
    const msg = String(error ?? "").trim();
    if (!msg) return;
    if (lastMessageRef.current === msg) return;
    lastMessageRef.current = msg;
    pushToast({ kind: "error", title, message: msg });
  }, [error, pushToast, title]);

  useEffect(() => {
    if (error) return;
    lastMessageRef.current = "";
  }, [error]);
}
