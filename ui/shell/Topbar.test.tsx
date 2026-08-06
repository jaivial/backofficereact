import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: () => ({
      activeEntry: null,
      wsConnected: false,
    }),
    useAtom: () => [
      {
        user: { role: "admin", name: "Test User", email: "test@test.com", sectionAccess: [], roleImportance: 100 },
        restaurants: [{ id: 1, name: "Test Restaurant" }],
        activeRestaurantId: 1,
      },
      vi.fn(),
    ],
  };
});

vi.mock("lucide-react", () => ({
  LogOut: () => <span data-testid="icon-logout" />,
  Store: () => <span data-testid="icon-store" />,
}));

vi.mock("../../api/client", () => ({
  createClient: () => ({
    auth: { setActiveRestaurant: vi.fn().mockResolvedValue({ success: true }), logout: vi.fn() },
  }),
}));

vi.mock("../inputs/DropdownMenu", () => ({
  DropdownMenu: ({ triggerContent }: { triggerContent: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{triggerContent}</div>
  ),
}));

vi.mock("../inputs/Select", () => ({
  Select: () => <div data-testid="select" />,
}));

vi.mock("../theme/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

vi.mock("../forky/ForkyToggle", () => ({
  ForkyToggle: () => <div data-testid="forky-toggle" />,
}));

vi.mock("../feedback/useToasts", () => ({
  useToasts: () => ({ pushToast: vi.fn() }),
}));

vi.mock("../nav/Breadcrumbs", () => ({
  Breadcrumbs: () => <nav data-testid="breadcrumbs" />,
}));

vi.mock("../../lib/rbac", () => ({
  hasSectionAccess: () => true,
}));

import { Topbar } from "./Topbar";

describe("Topbar", () => {
  it("renders with default props", () => {
    render(<Topbar title="Dashboard" />);
    const topbar = screen.getByLabelText("Topbar");
    expect(topbar).toBeInTheDocument();
  });

  it("displays title", () => {
    render(<Topbar title="Dashboard" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("applies className prop", () => {
    render(<Topbar title="Dashboard" className="custom-topbar" />);
    const topbar = screen.getByLabelText("Topbar");
    expect(topbar).toHaveClass("bo-topbar");
    expect(topbar).toHaveClass("custom-topbar");
  });
});
