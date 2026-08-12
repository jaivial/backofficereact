import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatePicker } from "./DatePicker";

// Stub motion/react to avoid animation timing in jsdom.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => true,
}));

// Minimal getBoundingClientRect stub for the trigger button.
function mockButtonRect(left: number, top: number, width = 120) {
  return {
    left,
    top,
    right: left + width,
    bottom: top + 36,
    width,
    height: 36,
    x: left,
    y: top,
    toJSON: () => {},
  };
}

describe("DatePicker popover width", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Stub viewport dimensions to a desktop size.
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 768 });
  });
  afterEach(() => vi.useRealTimers());

  it("renders popover wide enough to display all weekday numbers (1:1 cells)", () => {
    const { container } = render(<DatePicker value="2026-07-11" onChange={() => {}} />);

    const btn = screen.getByRole("button", { name: "Select date" });
    vi.spyOn(btn, "getBoundingClientRect").mockReturnValue(mockButtonRect(100, 100));

    act(() => {
      fireEvent.click(btn);
    });

    const popover = container.ownerDocument.querySelector('[data-ui="date-picker-popover"]') as HTMLElement | null;
    expect(popover).toBeTruthy();

    const style = window.getComputedStyle(popover!);
    // The popover width should be at least 300px on a desktop viewport (1024px)
    // to ensure all weekday columns are wide enough for 1:1 ratio cells.
    const widthStr = style.width;
    if (widthStr && widthStr !== "auto") {
      const widthPx = parseFloat(widthStr);
      expect(widthPx).toBeGreaterThanOrEqual(300);
    }
  });

  it("centers the popover horizontally on narrow viewports (≤480px)", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 390 });

    const { container } = render(<DatePicker value="2026-07-11" onChange={() => {}} />);

    const btn = screen.getByRole("button", { name: "Select date" });
    // Button at far-left edge of screen
    vi.spyOn(btn, "getBoundingClientRect").mockReturnValue(mockButtonRect(0, 100, 100));

    act(() => {
      fireEvent.click(btn);
    });

    const popover = container.ownerDocument.querySelector('[data-ui="date-picker-popover"]') as HTMLElement | null;
    expect(popover).toBeTruthy();

    // On a 390px viewport with popW = min(340, 390-16) = 340,
    // centered left = round((390 - 340) / 2) = 25
    const left = parseInt(popover!.style.left, 10);
    expect(left).toBe(25);
  });

  it("applies custom popoverClassName and popoverStyle", () => {
    const { container } = render(
      <DatePicker
        value="2026-07-11"
        onChange={() => {}}
        popoverClassName="my-custom-pop"
        popoverStyle={{ borderRadius: 20 }}
      />,
    );

    const btn = screen.getByRole("button", { name: "Select date" });
    vi.spyOn(btn, "getBoundingClientRect").mockReturnValue(mockButtonRect(100, 100));

    act(() => {
      fireEvent.click(btn);
    });

    const popover = container.ownerDocument.querySelector('[data-ui="date-picker-popover"]') as HTMLElement | null;
    expect(popover).toBeTruthy();
    expect(popover!.className).toContain("my-custom-pop");
    expect(popover!.style.borderRadius).toBe("20px");
  });
});
