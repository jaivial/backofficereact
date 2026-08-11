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
  Boxes: () => <span data-testid="icon-boxes" />,
  MonitorSmartphone: () => <span data-testid="icon-pos" />,
  Server: () => <span data-testid="icon-server" />,
}));

vi.mock("vike/client/router", () => ({
  navigate: vi.fn(),
  prefetch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/rbac", () => ({
  sidebarItemsForRole: () => [
    { key: "reservas", label: "Reservas", href: "/app/reservas" },
    { key: "menus", label: "Menus", href: "/app/menus" },
    { key: "stock", label: "Stock", href: "/app/stock" },
    { key: "pos", label: "TPV", href: "/app/pos" },
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

  it("renders stock and POS in desktop and mobile navigation", () => {
    render(<Sidebar pathname="/app" role="admin" />);
    expect(screen.getAllByTestId("nav-link-Stock")).toHaveLength(2);
    expect(screen.getAllByTestId("nav-link-TPV")).toHaveLength(2);
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

  it("navigates to the main home when the app logo is clicked", () => {
    render(<Sidebar pathname="/app/comida" role="admin" />);

    const logo = screen.getByTestId("sidebar-logo");
    expect(logo).toHaveAttribute("href", "/app/backoffice");
    expect(logo).toHaveAttribute("aria-label", "Ir al inicio de Villa Carmen");
    expect(logo.querySelector("img")).toHaveAttribute("alt", "Villa Carmen");
  });
});
