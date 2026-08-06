import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock the API client used inside TurnosView.
const mockEntriesList = vi.fn();
vi.mock("../../../../api/client", () => ({
  createClient: vi.fn(() => ({
    horarios: { list: vi.fn().mockResolvedValue({ success: true, schedules: [] }) },
    fichaje: {
      entries: { list: mockEntriesList, patch: vi.fn() },
      adminStart: vi.fn(),
      adminStop: vi.fn(),
    },
  })),
}));

vi.mock("../../../../ui/feedback/useToasts", () => ({
  useToasts: vi.fn(() => ({ pushToast: vi.fn() })),
}));
vi.mock("../../../../ui/feedback/useErrorToast", () => ({
  useErrorToast: vi.fn(),
}));

vi.mock("jotai", () => ({
  useAtomValue: vi.fn(() => ({ activeEntriesByMember: {} })),
  useSetAtom: vi.fn(() => vi.fn()),
  atom: vi.fn(),
}));

// The per-member view has its own data fetching and date-range UI; a stub keeps
// these tests focused on the subtab switcher behaviour.
vi.mock("./functionalComponents/MemberFilterView/MemberFilterView", () => ({
  MemberFilterView: () => <div data-testid="member-filter-view" />,
}));

import { TurnosView } from "./TurnosView";
import type { FichajeSchedule, Member } from "../../../../api/types";

const members: Member[] = [
  { id: 1, firstName: "Juan", lastName: "Perez" } as any,
  { id: 2, firstName: "Maria", lastName: "Lopez" } as any,
];

const schedules: FichajeSchedule[] = [
  { id: 10, memberId: 1, memberName: "Juan Perez", startTime: "09:00", endTime: "17:00" } as any,
];

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

describe("TurnosView (extracted component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntriesList.mockResolvedValue({ success: true, entries: [] });
    window.history.replaceState(null, "", "/app/horarios/turnos?date=2026-08-06");
  });

  it("renders the Turnos panel with the Miembro view", async () => {
    render(<TurnosView date="2026-08-06" members={members} schedules={schedules} error={null} />);
    expect(screen.getByTestId("horarios-turnos-section")).toBeInTheDocument();
    expect(screen.getByTestId("member-filter-view")).toBeInTheDocument();
    // The Tabla subtab is gone: no roster, no subtab switcher.
    expect(screen.queryByTestId("horarios-turnos-roster")).not.toBeInTheDocument();
    expect(screen.queryByTestId("horarios-turnos-subtabs")).not.toBeInTheDocument();
    expect(screen.queryByTestId("horarios-turnos-subtab-tabla")).not.toBeInTheDocument();
    expect(screen.queryByTestId("horarios-turnos-subtab-miembro")).not.toBeInTheDocument();
  });

  it("propagates schedules to an embedding parent via onSchedulesChange", async () => {
    const onSchedulesChange = vi.fn();
    const reloaded = [
      { id: 20, memberId: 2, memberName: "Maria Lopez", startTime: "08:00", endTime: "16:00" } as any,
    ];
    // First render fetches entries; selecting a date triggers loadSchedules -> onSchedulesChange.
    const client = await import("../../../../api/client");
    (client.createClient as any).mockReturnValue({
      horarios: { list: vi.fn().mockResolvedValue({ success: true, schedules: reloaded }) },
      fichaje: { entries: { list: mockEntriesList, patch: vi.fn() }, adminStart: vi.fn(), adminStop: vi.fn() },
    });

    render(
      <TurnosView
        date="2026-08-06"
        members={members}
        schedules={schedules}
        error={null}
        onDateChange={vi.fn()}
        onSchedulesChange={onSchedulesChange}
      />,
    );
    // Open the calendar and pick the first available day to drive selectDate -> loadSchedules.
    fireEvent.click(screen.getByTestId("horarios-turnos-calendar-btn"));
    const cells = await screen.findAllByTestId("calendar-day-cell");
    fireEvent.click(cells[0]);
    await waitFor(() => expect(onSchedulesChange).toHaveBeenCalledWith(reloaded));
  });
});
