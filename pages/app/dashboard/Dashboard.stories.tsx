import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const meta = {
  title: "Pages/Dashboard",
  component: Page,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    appShell: {
      title: "Dashboard",
      pathname: "/app/dashboard",
      data: {},
    },
  },
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no data)",
  parameters: {
    appShell: {
      title: "Dashboard",
      pathname: "/app/dashboard",
      data: {
        date: "2026-04-26",
        metrics: { date: "2026-04-26", total: 0, pending: 0, confirmed: 0, cancelled: 0, totalPeople: 0 },
        invoiceMetrics: { pendingCount: 0, pendingAmount: 0, monthIncome: 0, weekSentCount: 0 },
        error: null,
      },
    },
  },
};

export const Populated: Story = {
  name: "Populated",
  parameters: {
    appShell: {
      title: "Dashboard",
      pathname: "/app/dashboard",
      data: {
        date: "2026-04-26",
        metrics: { date: "2026-04-26", total: 24, pending: 5, confirmed: 18, cancelled: 1, totalPeople: 87 },
        invoiceMetrics: { pendingCount: 3, pendingAmount: 450.0, monthIncome: 12500.5, weekSentCount: 7 },
        error: null,
      },
    },
  },
};
