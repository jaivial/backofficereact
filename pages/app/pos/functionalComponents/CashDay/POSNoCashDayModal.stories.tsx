import type { Meta, StoryObj } from "@storybook/react";
import { POSNoCashDayModal } from "./POSNoCashDayModal";
import "../../../../../components/styles/features/pos/sell-screen.css";
import "../../../../../components/styles/features/pos/cash-day.css";

const meta = {
  title: "pos/CashDay/POSNoCashDayModal",
  component: POSNoCashDayModal,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof POSNoCashDayModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Sin caja abierta",
  args: {
    date: "2026-02-17",
    onOpenDay: async () => true,
    onPickDate: () => {},
  },
};

export const WithError: Story = {
  name: "Con días anteriores sin cerrar",
  args: {
    ...Default.args,
    error: "Hay días anteriores sin cerrar",
  },
};
