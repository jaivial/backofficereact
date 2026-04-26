import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Mapa de mesas", pathname: "/app/reservas/tables", data },
});

const meta = {
  title: "Pages/Reservas/Tables",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no tables)",
  parameters: shell({}),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({}),
};
