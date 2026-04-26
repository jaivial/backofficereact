import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Reportes", pathname: "/app/reportes", data },
});

const meta = {
  title: "Pages/Reportes",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no reports)",
  parameters: shell({
    report: null,
    quarterlyBreakdown: [],
    currentYear: 2026,
    error: null,
    customers: [],
  }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    report: {
      date_from: "2026-01-01",
      date_to: "2026-03-31",
      total_issued: 15000,
      total_iva_base: 12500,
      total_iva: 2625,
      total_irpf: 0,
      invoice_count: 45,
    },
    quarterlyBreakdown: [
      { quarter: "Q1", year: 2026, total_issued: 15000, total_iva: 2625, invoice_count: 45 },
    ],
    currentYear: 2026,
    error: null,
    customers: [
      { name: "Juan Garcia", email: "juan@example.com" },
      { name: "Maria Lopez", email: "maria@example.com" },
    ],
  }),
};
