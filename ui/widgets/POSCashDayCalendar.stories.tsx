import type { Meta, StoryObj } from "@storybook/react";
import { POSCashDayCalendar } from "./POSCashDayCalendar";
import "../../components/styles/features/pos/cash-day.css";

const meta = {
  title: "ui/widgets/POSCashDayCalendar",
  component: POSCashDayCalendar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<typeof POSCashDayCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Mes en curso",
  args: {
    year: 2026,
    month: 3,
    selectedDateISO: "2026-03-07",
    onSelectDate: () => {},
    onPrevMonth: () => {},
    onNextMonth: () => {},
  },
};

export const WithOpenDay: Story = {
  name: "Con el día en curso abierto",
  args: {
    ...Default.args,
    liveDay: {
      id: 900, date: "2026-03-07", status: "OPEN", openedBy: 7, openedByName: "Ana",
      closedBy: null, closedByName: "", openingCashCents: 10000,
      openedAt: "2026-03-07T08:00:00Z", closedAt: null, forcedOpen: false, notes: null,
      totalGrossCents: 128400, ticketCount: 42, covers: 96,
    },
  },
};
