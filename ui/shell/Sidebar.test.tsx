import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("jotai", () => ({
  useAtomValue: () => ({ user: { role: "admin", sectionAccess: [], roleImportance: 100 } }),
}));

vi.mock("lucide-react", () => ({
  CalendarDays: () => <span data-testid="icon-calendar" />,
  UtensilsCrossed: () => <span data-testid="icon-utensils" />,
  CookingPot: () => <span data-testid="icon-cooking" />,
  ShieldUser: () => <span data-testid="icon-shield" />,
  Link: () => <span data-testid="icon-link" />,
  Globe: () => <span data-testid="icon-globe" />,
  ClipboardCheck: () => <span data-testid="icon-clipboard" />,
  CalendarClock: () => <span data-testid="icon-calendar-clock" />,
  FileText: () => <span data-testid="icon-file" />,
  BarChart3: () => <span data-testid="icon-chart" />,
  Receipt: () => <span data-testid="icon-receipt" />,
  Home: () => <span data-testid="icon-home" />,
  Settings: () => <span data-testid="icon-settings" />,
  Ellipsis: () => <span data-testid="icon-ellipsis" />,
}));

vi.mock("../../lib/rbac", () => ({
  sidebarItemsForRole: () => [
    { key: "reservas", label: "Reservas", href: "/app/reservas" },
    { key: "menus", label: "Menus", href: "/app/menus" },
  ],
}));

vi.mock("../nav/NavLink", () => ({
  NavLink: ({ children, label }: { children: React.ReactNode; label: string }) => (
    <a href="#" data-testid={`nav-link-${label}`}>
      {children}
    </a>
  ),
}));

import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("renders with default props", () => {
    render(<Sidebar pathname="/app" role="admin" />);
    const sidebar = screen.getByLabelText("Sidebar");
    expect(sidebar).toBeInTheDocument();
  });

  it("applies className prop", () => {
    render(<Sidebar pathname="/app" role="admin" className="custom-sidebar" />);
    const sidebar = screen.getByLabelText("Sidebar");
    expect(sidebar).toHaveClass("bo-sidebar");
    expect(sidebar).toHaveClass("custom-sidebar");
  });

  it("renders without className when not provided", () => {
    render(<Sidebar pathname="/app" role="admin" />);
    const sidebar = screen.getByLabelText("Sidebar");
    expect(sidebar).toHaveClass("bo-sidebar");
    expect(sidebar.className).toBe("bo-sidebar");
  });
});
