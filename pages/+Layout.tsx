import React, { useMemo } from "react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { usePageContext } from "vike-react/usePageContext";

import "../components/bo.css";
import type { BOSession } from "../api/types";
import { ToastStack } from "../ui/feedback/ToastStack";
import { ThemeSync } from "../ui/theme/ThemeSync";
import { sessionAtom, themeAtom, type ThemeMode } from "../state/atoms";

function Hydrate({ theme, session }: { theme: ThemeMode; session: BOSession | null }) {
  // Prevent cross-request leakage on SSR by hydrating the per-request store.
  useHydrateAtoms([
    [themeAtom, theme],
    [sessionAtom, session],
  ]);
  return null;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext();
  const initialTheme: ThemeMode = pageContext.bo?.theme === "light" ? "light" : "dark";
  const initialSession = pageContext.bo?.session ?? null;

  const store = useMemo(() => createStore(), []);

  return (
    <JotaiProvider store={store}>
      <Hydrate theme={initialTheme} session={initialSession} />
      <ThemeSync />
      <ToastStack />
      <div id="bo-portal" />
      {children}
    </JotaiProvider>
  );
}
