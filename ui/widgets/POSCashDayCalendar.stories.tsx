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
