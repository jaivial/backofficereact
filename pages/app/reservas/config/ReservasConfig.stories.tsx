import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Configuración reservas", pathname: "/app/reservas/config", data },
});

const meta = {
  title: "Pages/Reservas/Config",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no config)",
  parameters: shell({
    date: "2026-04-26",
    day: null,
    dailyLimit: null,
    openingHours: null,
    mesasDeDos: null,
    mesasDeTres: null,
    floors: [],
    error: null,
  }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    date: "2026-04-26",
    day: { date: "2026-04-26", is_open: true },
    dailyLimit: { date: "2026-04-26", limit: 50 },
    openingHours: { date: "2026-04-26", hours: ["13:00", "13:30", "14:00", "20:00", "20:30", "21:00"] },
    mesasDeDos: { date: "2026-04-26", limit: "10" },
    mesasDeTres: { date: "2026-04-26", limit: "5" },
    floors: [{ date: "2026-04-26", floor_number: 1, active: true }, { date: "2026-04-26", floor_number: 2, active: true }],
    error: null,
  }),
};
