import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: () => ({
      user: { role: "admin", sectionAccess: [], roleImportance: 100 },
    }),
  };
});

vi.mock("../../lib/rbac", () => ({
  sidebarItemsForRole: () => [
    { key: "reservas", label: "Reservas", href: "/app/reservas" },
    { key: "menus", label: "Menus", href: "/app/menus" },
    { key: "fichaje", label: "Fichaje", href: "/app/fichaje" },
  ],
}));

vi.mock("lucide-react", () => ({
  CalendarDays: () => <span data-testid="icon-calendar" />,
  UtensilsCrossed: () => <span data-testid="icon-utensils" />,
  Clock: () => <span data-testid="icon-clock" />,
  ClipboardList: () => <span data-testid="icon-clipboard" />,
  LayoutDashboard: () => <span data-testid="icon-dashboard" />,
  Settings: () => <span data-testid="icon-settings" />,
}));

import { MobileNav } from "./MobileNav";

describe("MobileNav", () => {
  it("renders navigation", () => {
    render(<MobileNav pathname="/app" />);
    const nav = screen.getByLabelText("Navegacion principal");
    expect(nav).toBeInTheDocument();
  });

  it("applies className prop", () => {
    render(<MobileNav pathname="/app" className="custom-nav" />);
    const nav = screen.getByLabelText("Navegacion principal");
    expect(nav).toHaveClass("bo-mobile-nav");
    expect(nav).toHaveClass("custom-nav");
  });
});
