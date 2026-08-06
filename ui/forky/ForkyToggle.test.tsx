import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Provider, createStore } from "jotai";

import { ForkyToggle } from "./ForkyToggle";
import { forkyHiddenAtom } from "../../state/atoms";

const FORKY_HIDDEN_KEY = "forky_hidden";

let testStore: ReturnType<typeof createStore>;

beforeEach(() => {
  testStore = createStore();
  testStore.set(forkyHiddenAtom, false);
  localStorage.removeItem(FORKY_HIDDEN_KEY);
});

afterEach(() => {
  localStorage.removeItem(FORKY_HIDDEN_KEY);
});

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <Provider store={testStore}>{children}</Provider>;
}

describe("ForkyToggle", () => {
  it("renders with Bot icon when Forky is visible", () => {
    render(<ForkyToggle />, { wrapper: TestWrapper });
    const button = screen.getByTestId("forky-toggle");
    expect(button).toHaveAttribute("aria-label", "Ocultar mascota Forky");
    expect(button).toHaveAttribute("title", "Ocultar Forky");
  });

  it("renders with BotOff icon when Forky is hidden", () => {
    testStore.set(forkyHiddenAtom, true);
    render(<ForkyToggle />, { wrapper: TestWrapper });
    const button = screen.getByTestId("forky-toggle");
    expect(button).toHaveAttribute("aria-label", "Mostrar mascota Forky");
    expect(button).toHaveAttribute("title", "Mostrar Forky");
  });

  it("toggles hidden state and persists to localStorage on click", async () => {
    render(<ForkyToggle />, { wrapper: TestWrapper });
    const button = screen.getByTestId("forky-toggle");
    
    // Initially visible
    expect(testStore.get(forkyHiddenAtom)).toBe(false);
    expect(localStorage.getItem(FORKY_HIDDEN_KEY)).toBeNull();
    
    // Click to hide
    fireEvent.click(button);
    await waitFor(() => expect(testStore.get(forkyHiddenAtom)).toBe(true));
    expect(localStorage.getItem(FORKY_HIDDEN_KEY)).toBe("1");
    
    // Click to show
    fireEvent.click(button);
    await waitFor(() => expect(testStore.get(forkyHiddenAtom)).toBe(false));
    expect(localStorage.getItem(FORKY_HIDDEN_KEY)).toBeNull();
  });
});
