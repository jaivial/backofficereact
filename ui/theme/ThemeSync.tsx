import React, { useEffect } from "react";
import { useAtomValue } from "jotai";

import { themeAtom } from "../../state/atoms";

function writeCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

export function ThemeSync() {
  const theme = useAtomValue(themeAtom);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeCookie("bo_theme", theme);
  }, [theme]);

  return null;
}

