import React, { useCallback } from "react";
import { useAtom } from "jotai";
import { Moon, Sun } from "lucide-react";

import { themeAtom } from "../../state/atoms";

export function ThemeToggle() {
  const [theme, setTheme] = useAtom(themeAtom);
  const onToggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), [setTheme]);
  const isLight = theme === "light";
  const Icon = isLight ? Moon : Sun;
  return (
    <button className="w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] text-muted flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.12] hover:-translate-y-0.5" type="button" onClick={onToggle} aria-label={isLight ? "Switch to dark" : "Switch to light"}>
      <Icon size={18} strokeWidth={1.8} />
    </button>
  );
}

