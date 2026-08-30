import { createStore } from "jotai";

import type { BOSession } from "../api/types";
import {
  sessionAtom,
  sessionMovingExpirationAtom,
  themeAtom,
  type ThemeMode,
} from "./atoms";

export function initStore(
  theme: ThemeMode,
  session: BOSession | null,
  movingExpirationDate: string | null,
) {
  const store = createStore();
  store.set(themeAtom, theme);
  store.set(sessionAtom, session);
  store.set(sessionMovingExpirationAtom, movingExpirationDate);
  return store;
}
