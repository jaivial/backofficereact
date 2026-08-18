import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => {
  const Icon = () => React.createElement("span", { "data-testid": "menu-icon" });
  return {
    Lock: Icon,
    PencilLine: Icon,
    Repeat2: Icon,
    Star: Icon,
    Trash2: Icon,
    Users: Icon,
    UsersRound: Icon,
    UtensilsCrossed: Icon,
  };
});
vi.mock("../../shadcn/Switch", () => ({
  Switch: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { checked?: boolean }) =>
    React.createElement("button", { ...props, "data-testid": "menu-summary-switch" }),
}));

import { MenuSummaryCard } from "./MenuSummaryCard";

const menu = {
  id: 42,
  menu_title: "Menu de verano",
  price: "35",
  active: true,
  is_draft: false,
  menu_type: "closed_conventional",
};

describe("MenuSummaryCard", () => {
  it("orders title, status row, and price actions row in one column", () => {
    render(
      React.createElement(MenuSummaryCard, {
        menu,
        switchDisabled: false,
        actionsDisabled: false,
        onToggleActive: vi.fn(async () => undefined),
        onOpenEditor: vi.fn(),
        onRequestChangeType: vi.fn(),
        onRequestDelete: vi.fn(),
      }),
    );

    const card = screen.getByTestId("menu-summary-42");
    const title = card.querySelector('[data-slot="menu-summary-title"]') as HTMLElement;
    const statusRow = card.querySelector('[data-slot="menu-summary-status-row"]') as HTMLElement;
    const footerRow = card.querySelector('[data-slot="menu-summary-footer-row"]') as HTMLElement;

    expect(title).toHaveTextContent("Menu de verano");
    expect(within(statusRow).getByText("Cerrado convencional")).toBeInTheDocument();
    expect(within(statusRow).getByText("Activo")).toBeInTheDocument();
    expect(statusRow.querySelector('[data-slot="menu-summary-switch-wrapper"]')).toBeInTheDocument();
    expect(within(footerRow).getByText("35.00 €")).toBeInTheDocument();
    expect(within(footerRow).getByTestId("menu-summary-change-type-42")).toBeInTheDocument();
    expect(within(footerRow).getByTestId("menu-summary-edit-42")).toBeInTheDocument();
    expect(within(footerRow).getByTestId("menu-summary-delete-42")).toBeInTheDocument();
    expect(title.compareDocumentPosition(statusRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(statusRow.compareDocumentPosition(footerRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
