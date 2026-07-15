import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CalendarModal } from "./CalendarModal";

beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

const mockDays = [
  {
    date: "2026-07-01",
    workers: [
      {
        memberId: 1,
        memberName: "Juan Perez",
        photoUrl: "",
        schedules: [
          { startTime: "09:00", endTime: "14:00" },
          { startTime: "16:00", endTime: "20:00" },
        ],
      },
      {
        memberId: 2,
        memberName: "Maria Lopez",
        photoUrl: "",
        schedules: [{ startTime: "10:00", endTime: "18:00" }],
      },
    ],
  },
  {
    date: "2026-07-02",
    workers: [
      {
        memberId: 3,
        memberName: "Carlos Ruiz",
        photoUrl: "",
        schedules: [{ startTime: "08:00", endTime: "15:00" }],
      },
    ],
  },
  {
    date: "2026-07-15",
    workers: [],
  },
];

const mockCalendarApi = vi.fn();

vi.mock("../../../../../../api/client", () => ({
  createClient: () => ({
    horarios: {
      calendar: (...args: any[]) => mockCalendarApi(...args),
    },
  }),
}));

vi.mock("lucide-react", () => ({
  ChevronLeft: () => <span data-testid="chevron-left">{"<"}</span>,
  ChevronRight: () => <span data-testid="chevron-right">{">"}</span>,
  CalendarDays: () => <span data-testid="calendar-days" />,
  X: () => <span data-testid="x-icon" />,
  User: () => <span data-testid="user-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
}));

describe("CalendarModal", () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSelectDate: vi.fn(),
    year: 2026,
    month: 7,
    currentDate: "2026-07-15",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCalendarApi.mockResolvedValue({
      success: true,
      year: 2026,
      month: 7,
      totalMembers: 10,
      days: mockDays,
    });
  });

  it("renders month and year in header", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/julio.*2026/i)).toBeInTheDocument();
    });
  });

  it("shows weekday headers (L M M J V S D)", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("L")).toBeInTheDocument();
      expect(screen.getByText("D")).toBeInTheDocument();
    });
  });

  it("shows loading state initially", () => {
    mockCalendarApi.mockImplementationOnce(() => new Promise(() => {}));
    render(<CalendarModal {...defaultProps} />);

    expect(screen.getByTestId("calendar-loading")).toBeInTheDocument();
  });

  it("fetches calendar data on mount", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockCalendarApi).toHaveBeenCalledWith({ year: 2026, month: 7 });
    });
  });

  it("shows date numbers in cells", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("shows worker count per day", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("2/10")).toBeInTheDocument();
    });
  });

  it("shows 0 for days with no workers", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      const zeros = screen.getAllByText("0/10");
      expect(zeros.length).toBeGreaterThan(0);
    });
  });

  it("highlights the current selected date", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      const cells = screen.getAllByTestId("calendar-day-cell");
      const selected = cells.find(
        (c) => c.getAttribute("data-selected") === "true",
      );
      expect(selected).toBeTruthy();
      expect(selected).toHaveTextContent("15");
    });
  });

  it("calls onSelectDate when day cell is clicked", async () => {
    const onSelectDate = vi.fn();
    render(<CalendarModal {...defaultProps} onSelectDate={onSelectDate} />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByText("1").click();
    });

    expect(onSelectDate).toHaveBeenCalledWith("2026-07-01");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("does not render when open is false", () => {
    const { container } = render(
      <CalendarModal {...defaultProps} open={false} />,
    );

    expect(container.querySelector("[data-slot='calendar-modal']")).toBeNull();
  });

  it("shows worker names on hover over a day cell", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    const cell = screen.getByText("1").closest("[data-testid='calendar-day-cell']")!;
    await act(async () => {
      cell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("Juan Perez")).toBeInTheDocument();
      expect(screen.getByText("Maria Lopez")).toBeInTheDocument();
    });
  });

  it("shows schedule times on hover", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    const cell = screen.getByText("1").closest("[data-testid='calendar-day-cell']")!;
    await act(async () => {
      cell.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });

    await waitFor(() => {
      expect(screen.getByText("09:00 - 14:00")).toBeInTheDocument();
      expect(screen.getByText("16:00 - 20:00")).toBeInTheDocument();
    });
  });

  it("navigates to next month", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId("chevron-right").click();
    });

    await waitFor(() => {
      expect(mockCalendarApi).toHaveBeenCalledWith({ year: 2026, month: 8 });
    });
  });

  it("navigates to previous month", async () => {
    render(<CalendarModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("chevron-left")).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByTestId("chevron-left").click();
    });

    await waitFor(() => {
      expect(mockCalendarApi).toHaveBeenCalledWith({ year: 2026, month: 6 });
    });
  });
});
