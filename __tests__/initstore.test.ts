import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { initStore } from "../pages/+Layout";
import {
  forkyHiddenAtom,
  sessionAtom,
  sessionMovingExpirationAtom,
  themeAtom,
} from "../state/atoms";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("initStore (SSR-safe)", () => {
  it("does not read localStorage during the call", () => {
    // Simulate a returning user who previously hid Forky.
    localStorage.setItem("forky_hidden", "1");

    const store = initStore("dark", null, null);

    // The atom must default to false regardless of localStorage. Reading
    // localStorage must be deferred to a useEffect (see ForkyVisibilitySync)
    // so the first client render matches the SSR render.
    expect(store.get(forkyHiddenAtom)).toBe(false);
  });

  it("applies theme/session/movingExpirationDate atom values verbatim", () => {
    const store = initStore("light", null, "2026-01-01T00:00:00Z");
    expect(store.get(themeAtom)).toBe("light");
    expect(store.get(sessionAtom)).toBeNull();
    expect(store.get(sessionMovingExpirationAtom)).toBe("2026-01-01T00:00:00Z");
  });

  it("returns a fresh store on every call", () => {
    const a = initStore("dark", null, null);
    const b = initStore("dark", null, null);
    expect(a).not.toBe(b);
    a.set(themeAtom, "light");
    expect(b.get(themeAtom)).toBe("dark");
  });
});
