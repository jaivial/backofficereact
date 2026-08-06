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

  it("renders the Turnos panel with member cards in the default grid view", async () => {
    render(<TurnosView date="2026-08-06" members={members} schedules={schedules} error={null} />);
    expect(screen.getByTestId("horarios-turnos-section")).toBeInTheDocument();
    expect(await screen.findByText("Juan Perez")).toBeInTheDocument();
    expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
    // Scheduled member shows the schedule times.
    expect(screen.getByText("09:00")).toBeInTheDocument();
    expect(screen.getByText("17:00")).toBeInTheDocument();
  });

  it("switches to the Tabla view via the internal view tabs", async () => {
    render(<TurnosView date="2026-08-06" members={members} schedules={schedules} error={null} />);
    fireEvent.click(screen.getByTestId("horarios-turnos-view-table"));
    await waitFor(() => expect(screen.getByTestId("horarios-turnos-roster")).toBeInTheDocument());
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
