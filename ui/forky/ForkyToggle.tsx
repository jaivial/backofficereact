import { useCallback } from "react";
import { useAtom } from "jotai";
import { Bot, BotOff } from "lucide-react";

import { forkyHiddenAtom } from "../../state/atoms";
import { cn } from "../shadcn/utils";

const FORKY_HIDDEN_KEY = "forky_hidden";

/** Toggle Forky visibility and persist to localStorage. */
function toggleForkyHidden(setHidden: (fn: (prev: boolean) => boolean) => void): void {
  setHidden((prev) => {
    const next = !prev;
    try {
      if (next) {
        localStorage.setItem(FORKY_HIDDEN_KEY, "1");
      } else {
        localStorage.removeItem(FORKY_HIDDEN_KEY);
      }
    } catch {}
    return next;
  });
}

export function ForkyToggle({ className }: { className?: string }) {
  const [hidden, setHidden] = useAtom(forkyHiddenAtom);
  const onToggle = useCallback(() => toggleForkyHidden(setHidden), [setHidden]);
  const Icon = hidden ? BotOff : Bot;
  return (
    <button
      className={cn("bo-actionBtn", className)}
      type="button"
      onClick={onToggle}
      aria-label={hidden ? "Mostrar mascota Forky" : "Ocultar mascota Forky"}
      title={hidden ? "Mostrar Forky" : "Ocultar Forky"}
      data-testid="forky-toggle"
    >
      <Icon size={18} strokeWidth={1.8} />
    </button>
  );
}
