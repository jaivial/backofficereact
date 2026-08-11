import type { Meta, StoryObj } from "@storybook/react";
import { POSNoCashDayModal } from "./POSNoCashDayModal";
import "../../../../../components/styles/features/pos/cash-day.css";

const meta = {
  title: "pos/CashDay/POSNoCashDayModal",
  component: POSNoCashDayModal,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
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

export const WithUnclosedDays: Story = {
  name: "Con días anteriores sin cerrar",
  args: {
    date: "2026-02-17",
    unclosedPrevious: [
      { id: 1, date: "2026-02-15", status: "OPEN", openedBy: 1, openedByName: "María", closedBy: null, closedByName: "", openingCashCents: 10000, openedAt: "2026-02-15T09:00:00Z", closedAt: null, forcedOpen: false, notes: null },
      { id: 2, date: "2026-02-16", status: "OPEN", openedBy: 2, openedByName: "Juan", closedBy: null, closedByName: "", openingCashCents: 15000, openedAt: "2026-02-16T09:00:00Z", closedAt: null, forcedOpen: false, notes: null },
    ],
    onOpenDay: async () => true,
    onPickDate: () => {},
  },
};

export const WithError: Story = {
  name: "Con error de validación",
  args: {
    ...Default.args,
    error: "Escribe un importe válido",
  },
};
