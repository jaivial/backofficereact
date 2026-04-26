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
    integrations: {
      n8nWebhookUrl: "https://n8n.example.com/webhook/abc",
      enabledEvents: ["booking.created", "booking.cancelled"],
      uazapiUrl: "",
      uazapiToken: "",
      restaurantWhatsappNumbers: [],
    },
    branding: {
      brandName: "Alqueria Villa Carmen",
      logoUrl: "",
      primaryColor: "#1a1a2e",
      accentColor: "",
      emailFromName: "Villa Carmen",
      emailFromAddress: "info@villacarmen.es",
    },
    invoiceSettings: {
      format: { prefix: "F-", suffix: "", startingNumber: 1, format: "F-{YYYY}-{0001}", paddingZeros: 4 },
      nextNumber: 4,
      defaultPdfTemplate: "basic",
    },
    websiteMenuTemplates: null,
    error: null,
  }),
};
