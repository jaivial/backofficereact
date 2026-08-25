import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DropdownMenu } from "./DropdownMenu";

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

beforeEach(() => {
  // jsdom doesn't lay out elements, so getBoundingClientRect returns zeros.
  // Provide a sane rect so positioning code in DropdownMenu does not throw.
  HTMLElement.prototype.getBoundingClientRect = function () {
    return mockButtonRect(20, 20);
  };
  // Ensure there is a portal root for the menu.
  if (!document.getElementById("bo-portal")) {
    const portal = document.createElement("div");
    portal.id = "bo-portal";
    document.body.appendChild(portal);
  }
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("DropdownMenu", () => {
  const items = [
    { id: "edit", label: "Edit", onSelect: vi.fn() },
    { id: "delete", label: "Delete", onSelect: vi.fn() },
  ];

  it("opens the menu when the trigger button is clicked", async () => {
    render(<DropdownMenu label="Actions" items={items} />);
    const trigger = screen.getByRole("button", { name: /Actions/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    act(() => {
      trigger.click();
    });

    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.getByText("Edit")).toBeTruthy();
    expect(screen.getByText("Delete")).toBeTruthy();
  });

  it("treats a Safari-style pointerdown as an outside click only when target is outside the trigger and menu", async () => {
    render(<DropdownMenu label="Actions" items={items} />);
    const trigger = screen.getByRole("button", { name: /Actions/ });

    // Open the dropdown via click.
    act(() => {
      trigger.click();
    });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));

    // Simulate a Safari-style pointerdown that fires on the trigger itself.
    // This must NOT close the menu — the outside-click handler is bound with
    // pointerdown and must allow taps on the trigger to be ignored.
    const triggerEvt = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(triggerEvt, "target", { value: trigger });
    await act(async () => {
      window.dispatchEvent(triggerEvt);
    });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Now dispatch a pointerdown on an element that is neither trigger nor menu.
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    const outsideEvt = new Event("pointerdown", { bubbles: true });
    Object.defineProperty(outsideEvt, "target", { value: outside });
    await act(async () => {
      window.dispatchEvent(outsideEvt);
    });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("calls onSelect and closes when a menu item is clicked", async () => {
    const onEdit = vi.fn();
    render(<DropdownMenu label="Actions" items={[{ id: "edit", label: "Edit", onSelect: onEdit }]} />);
    const trigger = screen.getByRole("button", { name: /Actions/ });

    act(() => {
      trigger.click();
    });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));

    act(() => {
      screen.getByText("Edit").click();
    });
    expect(onEdit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("closes on Escape key", async () => {
    render(<DropdownMenu label="Actions" items={items} />);
    const trigger = screen.getByRole("button", { name: /Actions/ });

    act(() => {
      trigger.click();
    });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });
});
