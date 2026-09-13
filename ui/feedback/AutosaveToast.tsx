import { useEffect, useRef } from "react";
import { useToasts } from "./useToasts";

type SaveState = "idle" | "saving" | "saved" | "error";

/** Coordination id: comida_autosave_v1. Replaces, rather than stacks, save notifications. */
export function AutosaveToast({ state }: { state: SaveState }) {
  const { pushToast, dismissToast } = useToasts();
  const started = useRef(false);

  useEffect(() => {
    if (state === "idle" || (!started.current && state !== "saving")) return;
    started.current = true;
    const id = pushToast({
      kind: state === "error" ? "error" : state === "saved" ? "success" : "info",
      title: state === "saving" ? "Guardando..." : state === "saved" ? "Guardado" : "Error guardando",
      timeoutMs: state === "saving" ? 0 : 3200,
    });
    return () => dismissToast(id);
  }, [state, pushToast, dismissToast]);

  return null;
}
