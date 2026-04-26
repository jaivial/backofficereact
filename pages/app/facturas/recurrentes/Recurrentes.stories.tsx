import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Facturas recurrentes", pathname: "/app/facturas/recurrentes", data },
});

const meta = {
  title: "Pages/Facturas/Recurrentes",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no recurring invoices)",
  parameters: shell({
    recurringInvoices: [],
    total: 0,
    page: 1,
    limit: 20,
    error: null,
    activeCount: 0,
    pausedCount: 0,
  }),
};
