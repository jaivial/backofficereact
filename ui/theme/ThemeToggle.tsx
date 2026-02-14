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
    <button className="bo-actionBtn" type="button" onClick={onToggle} aria-label={isLight ? "Switch to dark" : "Switch to light"}>
      <Icon size={18} strokeWidth={1.8} />
    </button>
  );
}

