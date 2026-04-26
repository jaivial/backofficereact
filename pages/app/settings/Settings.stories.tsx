import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Ajustes", pathname: "/app/settings", data },
});

const meta = {
  title: "Pages/Settings",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no settings)",
  parameters: shell({
    integrations: null,
    branding: null,
    invoiceSettings: null,
    websiteMenuTemplates: null,
    error: null,
  }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    integrations: { cloudflare: { enabled: false }, bunny: { enabled: true } },
    branding: { logo_url: "", primary_color: "#1a1a2e", restaurant_name: "Alqueria Villa Carmen" },
    invoiceSettings: { default_payment_method: "transfer", invoice_prefix: "F", next_number: 4, tax_rate: 21 },
    websiteMenuTemplates: null,
    error: null,
  }),
};
