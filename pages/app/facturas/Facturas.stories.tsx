import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Facturas", pathname: "/app/facturas", data },
});

const meta = {
  title: "Pages/Facturas",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no invoices)",
  parameters: shell({
    invoices: [],
    total: 0,
    page: 1,
    limit: 20,
    error: null,
  }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    invoices: [
      { id: 1, invoice_number: "F-001", customer_name: "Juan Garcia", customer_email: "juan@example.com", amount: 120.50, status: "enviada", invoice_date: "2026-04-20", due_date: "2026-05-20", is_reservation: true, reservation_id: 1 },
      { id: 2, invoice_number: "F-002", customer_name: "Maria Lopez", customer_email: "maria@example.com", amount: 85.00, status: "pendiente", invoice_date: "2026-04-22", due_date: "2026-05-22", is_reservation: false, reservation_id: null },
      { id: 3, invoice_number: "F-003", customer_name: "Carlos Ruiz", customer_email: "carlos@example.com", amount: 210.00, status: "pagada", invoice_date: "2026-04-18", due_date: "2026-05-18", is_reservation: true, reservation_id: 3 },
    ],
    total: 3,
    page: 1,
    limit: 20,
    error: null,
  }),
};
