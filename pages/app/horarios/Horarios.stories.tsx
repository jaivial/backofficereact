import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Horarios", pathname: "/app/horarios", data },
});

const meta = {
  title: "Pages/Horarios",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no schedules)",
  parameters: shell({
    date: "2026-04-26",
    year: 2026,
    month: 4,
    members: [],
    schedules: [],
    monthDays: [],
    bookingMonthDays: [],
    error: null,
    isAdmin: true,
  }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    date: "2026-04-26",
    year: 2026,
    month: 4,
    members: [
      { id: 1, firstName: "Pedro", lastName: "Martinez", roleSlug: "jefe_cocina", email: "pedro@villacarmen.local", active: true },
      { id: 2, firstName: "Ana", lastName: "Sanchez", roleSlug: "camarero", email: "ana@villacarmen.local", active: true },
    ],
    schedules: [
      { id: 1, date: "2026-04-26", memberId: 1, startTime: "08:00", endTime: "16:00" },
      { id: 2, date: "2026-04-26", memberId: 2, startTime: "12:00", endTime: "20:00" },
    ],
    monthDays: [],
    bookingMonthDays: [],
    error: null,
    isAdmin: true,
  }),
};
