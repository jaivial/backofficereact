import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Estado de Cuenta", pathname: "/app/estado-cuenta", data },
});

const meta = {
  title: "Pages/EstadoCuenta",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no customers)",
  parameters: shell({ customers: [] }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    customers: [
      { name: "Juan Garcia", email: "juan@example.com", dni_cif: "12345678A" },
      { name: "Maria Lopez", email: "maria@example.com", dni_cif: "87654321B" },
    ],
  }),
};
