import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
  ChevronDown: () => React.createElement("span", { "data-testid": "chevron-down-icon" }),
  ChevronLeft: () => React.createElement("span", { "data-testid": "chevron-left-icon" }),
  ChevronUp: () => React.createElement("span", { "data-testid": "chevron-up-icon" }),
  Filter: () => React.createElement("span", { "data-testid": "filter-icon" }),
  FilterX: () => React.createElement("span", { "data-testid": "filter-x-icon" }),
  Lock: () => React.createElement("span", { "data-testid": "lock-icon" }),
  Plus: () => React.createElement("span", { "data-testid": "plus-icon" }),
  Star: () => React.createElement("span", { "data-testid": "star-icon" }),
  Users: () => React.createElement("span", { "data-testid": "users-icon" }),
  UsersRound: () => React.createElement("span", { "data-testid": "users-round-icon" }),
  UtensilsCrossed: () => React.createElement("span", { "data-testid": "utensils-icon" }),
}));
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: { div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => React.createElement("div", props, children) },
  useReducedMotion: () => true,
}));
const mockMenuSearch = vi.hoisted(() => ({ menutype: undefined as string | undefined }));
vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => ({ data: { menus: [], error: null }, urlParsed: { search: mockMenuSearch } }),
}));
vi.mock("../../../api/client", () => ({
  createClient: () => ({ menus: { gruposV2: {} } }),
}));
vi.mock("../../../ui/feedback/useErrorToast", () => ({ useErrorToast: vi.fn() }));
vi.mock("../../../ui/feedback/useToasts", () => ({ useToasts: () => ({ pushToast: vi.fn() }) }));
vi.mock("../../../ui/actions/FloatingActionButton", () => ({
  FloatingActionButton: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement("button", props, "Crear menu"),
}));
vi.mock("../../../ui/overlays/Modal", () => ({
  Modal: ({ open, children, title }: { open: boolean; children: React.ReactNode; title: string }) =>
    open ? React.createElement("div", { role: "dialog", "aria-label": title }, children) : null,
}));
vi.mock("../../../ui/overlays/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("../../../ui/widgets/menus/MenuTypeChangeModal", () => ({ MenuTypeChangeModal: () => null }));
vi.mock("../../../ui/widgets/menus/MenuTypePanelGrid", () => ({
  MenuTypePanelGrid: ({ onSelect }: { onSelect: (type: string) => void }) => React.createElement(
    "button",
    { "data-testid": "type-grid", onClick: () => onSelect("closed_conventional") },
    "Menu cerrado convencional",
  ),
}));
vi.mock("../../../ui/widgets/menus/MenuSummaryCard", () => ({ MenuSummaryCard: () => null }));
vi.mock("./crear/crear", () => ({ CrearPage: ({ onClose }: { onClose?: () => void }) => React.createElement("button", { onClick: onClose, "data-testid": "mock-menu-editor-close" }, "Editor") }));

import Page from "./+Page";

describe("MenusPage create flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMenuSearch.menutype = undefined;
    window.history.replaceState({}, "", "/app/menus");
  });

  it("opens the selected menu type when loaded from its query URL", () => {
    mockMenuSearch.menutype = "menucerradoconvencional";

    render(React.createElement(Page));

    expect(screen.getByTestId("menus-page-back-button")).toBeInTheDocument();
    expect(screen.queryByTestId("type-grid")).not.toBeInTheDocument();
  });

  it("writes the selected menu type to the query URL", () => {
    render(React.createElement(Page));

    fireEvent.click(screen.getByTestId("type-grid"));

    expect(window.location.pathname).toBe("/app/menus");
    expect(window.location.search).toBe("?menutype=menucerradoconvencional");
    expect(screen.getByTestId("menus-page-back-button")).toBeInTheDocument();
  });

  it("opens menu creator modal from floating plus button", () => {
    render(React.createElement(Page));

    fireEvent.click(screen.getByTestId("menus-page-create-button"));

    expect(screen.getByRole("dialog", { name: "Crear menu" })).toBeInTheDocument();
    expect(screen.getByTestId("mock-menu-editor-close")).toBeInTheDocument();
  });

  it("closes menu creator modal without navigating", () => {
    render(React.createElement(Page));
    fireEvent.click(screen.getByTestId("menus-page-create-button"));
    fireEvent.click(screen.getByTestId("mock-menu-editor-close"));

    expect(screen.queryByRole("dialog", { name: "Crear menu" })).not.toBeInTheDocument();
  });
});
