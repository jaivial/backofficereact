import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock the extracted Turnos view so we only assert switching behavior here.
vi.mock("./turnos/TurnosView", () => ({
  TurnosView: () => <div data-testid="mock-turnos-view">TURNOS_VIEW</div>,
}));

// Mock the API client (constructor returns an object; not called in these paths).
vi.mock("../../../api/client", () => ({
  createClient: vi.fn(() => ({
    horarios: {
      list: vi.fn(),
      month: vi.fn(),
      calendar: vi.fn().mockResolvedValue({ success: true, days: [] }),
      assign: vi.fn(),
    },
    calendar: { getMonth: vi.fn() },
  })),
}));

vi.mock("../../../ui/feedback/useToasts", () => ({
  useToasts: vi.fn(() => ({ pushToast: vi.fn() })),
}));
vi.mock("../../../ui/feedback/useErrorToast", () => ({
  useErrorToast: vi.fn(),
}));

// Jotai atoms: provide a stable realtime value and a no-op setter.
vi.mock("jotai", () => ({
  useAtomValue: vi.fn(() => ({ activeEntriesByMember: {}, pendingScheduleUpdates: false })),
  useSetAtom: vi.fn(() => vi.fn()),
  atom: vi.fn(),
}));

let mockSearch: Record<string, string> = {};
vi.mock("vike-react/usePageContext", () => ({
  usePageContext: () => ({
    data: pageData,
    urlParsed: { search: mockSearch },
    urlPathname: "/app/horarios",
  }),
}));

import Page from "./horarios";

const pageData = {
  date: "2026-08-06",
  year: 2026,
  month: 8,
  members: [] as any[],
  schedules: [] as any[],
  monthDays: [] as any[],
  bookingMonthDays: [] as any[],
  error: null,
  isAdmin: true,
};

describe("Horarios in-panel tab switcher", () => {
  beforeEach(() => {
    mockSearch = {};
    window.history.replaceState(null, "", "/app/horarios?date=2026-08-06");
  });

  it("defaults to the Tabla tab and shows the schedules table", () => {
    render(<Page />);
    const tablaTab = screen.getByRole("tab", { name: /Tabla/i });
    expect(tablaTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Turnos/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("table", { name: /Tabla de horarios del dia/i })).toBeInTheDocument();
    expect(screen.queryByTestId("mock-turnos-view")).not.toBeInTheDocument();
  });

  it("switches to Turnos, renders TurnosView, and persists ?tab=turnos in the URL", async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("tab", { name: /Turnos/i }));

    await waitFor(() => expect(screen.getByTestId("mock-turnos-view")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: /Turnos/i })).toHaveAttribute?.("aria-selected", "true");
    expect(screen.queryByRole("table", { name: /Tabla de horarios del dia/i })).not.toBeInTheDocument();
    expect(new URL(window.location.href).searchParams.get("tab")).toBe("turnos");
  });

  it("switching back to Tabla removes ?tab from the URL", async () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("tab", { name: /Turnos/i }));
    await waitFor(() => expect(screen.getByTestId("mock-turnos-view")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("tab", { name: /Tabla/i }));
    await waitFor(() => expect(screen.getByRole("table", { name: /Tabla de horarios del dia/i })).toBeInTheDocument());
    expect(new URL(window.location.href).searchParams.get("tab")).toBeNull();
  });

  it("honors ?tab=turnos on initial load", async () => {
    mockSearch = { tab: "turnos", date: "2026-08-06" };
    render(<Page />);
    await waitFor(() => expect(screen.getByTestId("mock-turnos-view")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: /Turnos/i })).toHaveAttribute("aria-selected", "true");
  });
});
