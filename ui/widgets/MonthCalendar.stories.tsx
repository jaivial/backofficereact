import type { Meta, StoryObj } from "@storybook/react";
import { MonthCalendar } from "./MonthCalendar";
import type { CalendarDay } from "../../api/types";

const meta = {
  title: "ui/widgets/MonthCalendar",
  component: MonthCalendar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MonthCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper to generate days for a month
function generateDays(year: number, month: number, config: {
  openDays?: boolean[];
  occupancyFn?: (day: number) => { total_people: number; limit: number };
}): CalendarDay[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const defaultOpenDays = [true, true, true, true, true, true, true];
  const openDays = config.openDays || defaultOpenDays;

  const days: CalendarDay[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dow = (new Date(year, month - 1, day).getDay() + 6) % 7; // Monday = 0
    const isOpen = openDays[dow];

    if (isOpen) {
      const occupancy = config.occupancyFn ? config.occupancyFn(day) : { total_people: 0, limit: 50 };
      days.push({
        date,
        booking_count: Math.floor(occupancy.total_people / 4),
        total_people: occupancy.total_people,
        limit: occupancy.limit,
        is_open: true,
      });
    } else {
      days.push({
        date,
        booking_count: 0,
        total_people: 0,
        limit: 0,
        is_open: false,
      });
    }
  }
  return days;
}

export const Default: Story = {
  name: "Default",
  args: {
    year: 2026,
    month: 4,
    days: generateDays(2026, 4, {}),
    selectedDateISO: "",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
    loading: false,
  },
};

export const WithSelectedDate: Story = {
  name: "With Selected Date",
  args: {
    year: 2026,
    month: 4,
    days: generateDays(2026, 4, {}),
    selectedDateISO: "2026-04-15",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
    loading: false,
  },
};

export const MixedOccupancy: Story = {
  name: "Mixed Occupancy",
  args: {
    year: 2026,
    month: 4,
    days: generateDays(2026, 4, {
      occupancyFn: (day) => {
        if (day <= 5) return { total_people: 10, limit: 50 };
        if (day <= 10) return { total_people: 45, limit: 50 };
        if (day <= 15) return { total_people: 52, limit: 50 };
        if (day <= 20) return { total_people: 40, limit: 50 };
        if (day <= 25) return { total_people: 25, limit: 50 };
        return { total_people: 5, limit: 50 };
      },
    }),
    selectedDateISO: "",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
    loading: false,
  },
};

export const FullyBookedWeekend: Story = {
  name: "Fully Booked Weekend",
  args: {
    year: 2026,
    month: 4,
    days: generateDays(2026, 4, {
      occupancyFn: (day) => {
        const date = new Date(2026, 3, day);
        const dow = date.getDay();
        const isWeekend = dow === 0 || dow === 6;
        return isWeekend
          ? { total_people: 50, limit: 50 }
          : { total_people: 15, limit: 50 };
      },
    }),
    selectedDateISO: "",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
    loading: false,
  },
};

export const ClosedSundays: Story = {
  name: "Closed Sundays",
  args: {
    year: 2026,
    month: 4,
    days: generateDays(2026, 4, {
      openDays: [true, true, true, true, true, true, false], // Sunday closed
      occupancyFn: (day) => ({ total_people: 20, limit: 50 }),
    }),
    selectedDateISO: "",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
    loading: false,
  },
};

export const Loading: Story = {
  name: "Loading",
  args: {
    year: 2026,
    month: 4,
    days: [],
    selectedDateISO: "",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
    loading: true,
  },
};

export const February: Story = {
  name: "February (28 days)",
  args: {
    year: 2026,
    month: 2,
    days: generateDays(2026, 2, {
      openDays: [true, true, true, true, true, true, false],
      occupancyFn: (day) => ({ total_people: day * 2, limit: 50 }),
    }),
    selectedDateISO: "",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
    loading: false,
  },
};

export const December: Story = {
  name: "December (starts on Monday)",
  args: {
    year: 2025,
    month: 12,
    days: generateDays(2025, 12, {}),
    selectedDateISO: "2025-12-25",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
    loading: false,
  },
};

export const CustomClassName: Story = {
  name: "With Custom Class",
  args: {
    year: 2026,
    month: 4,
    days: generateDays(2026, 4, {}),
    selectedDateISO: "",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
    loading: false,
    className: "max-w-md mx-auto",
  },
};
