import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// vi.mock factories are hoisted above imports, so shared spies live here.
const { setPreference, sessionMock, usePageContextMock } = vi.hoisted(() => ({
  setPreference: vi.fn(),
  sessionMock: { user: { id: 7 }, restaurants: [], activeRestaurantId: 1 } as any,
  usePageContextMock: vi.fn(),
}));

vi.mock("../../../api/client", () => {
  const noData = vi.fn().mockResolvedValue({ success: false });
  return {
    createClient: () => ({
      reservas: { list: noData, cancel: noData, exportDay: noData, get: noData, create: noData, patch: noData, search: noData },
      config: { getDailyLimit: noData, getDay: noData, setDay: noData },
      calendar: { getMonth: noData },
      dashboard: { getMetrics: noData },
      auth: { setPreference, me: noData, login: noData, logout: noData, setPassword: noData, setActiveRestaurant: noData },
    }),
  };
});

vi.mock("../../../state/atoms", async () => {
  const { atom } = await vi.importActual<any>("jotai");
  return {
    sessionAtom: atom(sessionMock),
    fichajeRealtimeAtom: atom({ activeEntry: null, wsConnected: false }),
    themeAtom: atom("dark"),
  };
});

vi.mock("../../../ui/feedback/useToasts", () => ({ useToasts: () => ({ pushToast: vi.fn() }) }));
vi.mock("../../../ui/feedback/useErrorToast", () => ({ useErrorToast: vi.fn() }));
vi.mock("../../../ui/assets/logopdf.webp", () => ({ default: "logo.webp" }));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: { div: (p: any) => <div {...p} /> },
  useReducedMotion: () => true,
}));

vi.mock("vike-react/usePageContext", () => ({ usePageContext: usePageContextMock }));

// Heavy visual children -> trivial stubs so the page renders in isolation.
vi.mock("../../../ui/widgets/MonthCalendar", () => ({ MonthCalendar: () => <div data-ui="month-cal" /> }));
vi.mock("../../../ui/widgets/DonutOccupancy", () => ({ DonutOccupancy: () => <div data-ui="donut" /> }));
vi.mock("../../../ui/widgets/ReservationDayPanel", () => ({ ReservationDayPanel: () => <div data-ui="day-panel" /> }));
vi.mock("../../../ui/layout/ScrollArea", () => ({ ScrollArea: ({ children }: any) => <div>{children}</div> }));
vi.mock("../../../ui/overlays/Modal", () => ({ Modal: ({ children, open }: any) => (open ? <div data-ui="modal">{children}</div> : null) }));
vi.mock("../../../ui/overlays/ModalHeader", () => ({ ModalHeader: () => null }));
vi.mock("../../../ui/overlays/ConfirmDialog", () => ({ ConfirmDialog: () => null }));
vi.mock("./functionalComponents/BookingEditor/BookingEditor", () => ({ BookingEditor: () => null }));
vi.mock("./functionalComponents/BookingSearch/BookingSearch", () => ({ BookingSearch: () => null }));
vi.mock("./functionalComponents/BookingDetailsPanel", () => ({ BookingDetailsPanel: () => null }));
vi.mock("./functionalComponents/SearchResultsTable", () => ({ SearchResultsTable: () => null }));
vi.mock("./functionalComponents/BookingsViewTabs/BookingsViewTabs", () => ({ BookingsViewTabs: () => <div data-ui="view-tabs" /> }));
vi.mock("./functionalComponents/BookingCardGrid/BookingCardGrid", () => ({ BookingCardGrid: () => null }));

import Page from "./reservas";

function makeData(overrides: Record<string, unknown> = {}): any {
  return {
    date: "2026-01-01",
    bookings: [],
    floors: [],
    total_count: 0,
    page: 1,
    count: 15,
    calendarDays: [],
    dailyLimit: null,
    metrics: null,
    day: { date: "2026-01-01", isOpen: true },
    error: null,
    ...overrides,
  };
}

describe("reservas display-mode persistence", () => {
  beforeEach(() => {
    cleanup();
    setPreference.mockReset();
    setPreference.mockResolvedValue({ success: true, preferences: {} });
    usePageContextMock.mockReturnValue({ data: makeData() });
  });

  it("hydrates the grid tab as active when SSR data.displayMode = grid", () => {
    usePageContextMock.mockReturnValue({ data: makeData({ displayMode: "grid" }) });
    render(<Page />);

    expect(screen.getByTestId("reservas-display-grid")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("reservas-display-tabla")).toHaveAttribute("aria-selected", "false");
  });

  it("hydrates the tabla tab as active when SSR data.displayMode = tabla", () => {
    usePageContextMock.mockReturnValue({ data: makeData({ displayMode: "tabla" }) });
    render(<Page />);

    expect(screen.getByTestId("reservas-display-tabla")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("reservas-display-grid")).toHaveAttribute("aria-selected", "false");
  });

  it("defaults to tabla when no displayMode is provided by SSR", () => {
    render(<Page />);

    expect(screen.getByTestId("reservas-display-tabla")).toHaveAttribute("aria-selected", "true");
  });

  it("persists the new mode via api.auth.setPreference when the user switches tabs", () => {
    usePageContextMock.mockReturnValue({ data: makeData({ displayMode: "grid" }) });
    render(<Page />);

    fireEvent.click(screen.getByTestId("reservas-display-tabla"));

    expect(setPreference).toHaveBeenCalledTimes(1);
    expect(setPreference).toHaveBeenCalledWith("reservasDisplayMode", "tabla");
  });

  it("does not persist when clicking the already-active tab", () => {
    usePageContextMock.mockReturnValue({ data: makeData({ displayMode: "tabla" }) });
    render(<Page />);

    fireEvent.click(screen.getByTestId("reservas-display-tabla"));

    expect(setPreference).not.toHaveBeenCalled();
  });
});
