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
      report_type: "iva",
      date_from: "2026-01-01",
      date_to: "2026-03-31",
      generated_at: "2026-04-26T10:00:00Z",
      summary: {
        total_base: 12500,
        total_iva: 2625,
        total: 15125,
        invoice_count: 45,
        credit_note_count: 2,
        credit_note_base: 300,
        credit_note_iva: 63,
        net_base: 12200,
        net_iva: 2562,
        net_total: 14762,
      },
      breakdown_by_rate: [
        { iva_rate: 21, base_amount: 12500, iva_amount: 2625, invoice_count: 45, credit_note_count: 2, credit_note_base: 300, credit_note_iva: 63 },
      ],
      quarterly_breakdown: [
        { quarter: "2026-Q1", quarterLabel: "Q1 2026", start_date: "2026-01-01", end_date: "2026-03-31", base_amount: 12500, iva_amount: 2625, total: 15125, invoice_count: 45, credit_note_count: 2, credit_note_base: 300, credit_note_iva: 63 },
      ],
      invoices: [],
    },
    quarterlyBreakdown: [],
    currentYear: 2026,
    error: null,
    customers: [
      { name: "Juan Garcia", email: "juan@example.com" },
      { name: "Maria Lopez", email: "maria@example.com" },
    ],
  }),
};
