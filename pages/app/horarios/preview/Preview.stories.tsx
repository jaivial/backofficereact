import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Horarios - Vista previa", pathname: "/app/horarios/preview", data },
});

const meta = {
  title: "Pages/Horarios/Preview",
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
    members: [],
    schedules: [],
    monthDays: [],
    error: null,
  }),
};
