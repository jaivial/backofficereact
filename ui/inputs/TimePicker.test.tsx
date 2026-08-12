import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TimePicker } from "./TimePicker";

// Stub motion/react to avoid animation timing in jsdom.
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  useReducedMotion: () => true,
}));

// Minimal getBoundingClientRect stub for the trigger wrapper.
function mockRect(left: number, top: number, width: number, height = 36) {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => {},
  };
}

describe("TimePicker dropdown width", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 768 });
  });
  afterEach(() => vi.useRealTimers());

  it("does not set an explicit width on the dropdown (CSS fit-content sizes it)", () => {
    const { container } = render(<TimePicker value="13:00" onChange={() => {}} />);

    const btn = screen.getByRole("button", { name: "Select time" });
    const wrapper = btn.closest('[data-ui="time-picker-wrapper"]') as HTMLElement;
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(mockRect(100, 100, 300));

    act(() => {
      fireEvent.click(btn);
    });

    const list = container.ownerDocument.querySelector('[data-ui="time-picker-list"]') as HTMLElement | null;
    expect(list).toBeTruthy();
    // Even though the trigger is 300px wide, the dropdown must NOT inherit that
    // width inline; CSS width:fit-content controls it.
    expect(list!.style.width).toBe("");
  });
});
