import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Turnos", pathname: "/app/horarios/turnos", data },
});

const meta = {
  title: "Pages/Horarios/Turnos",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty",
  parameters: shell({
    date: "2026-04-26",
    schedules: [],
    members: [],
    error: null,
  }),
};
