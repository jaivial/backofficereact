import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Configuracion", pathname: "/app/config", data },
});

const meta = {
  title: "Pages/Config",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no config)",
  parameters: shell({ defaults: null, floors: [], restaurantInfo: null, error: null }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    defaults: { openingMode: "both", morningHours: ["13:00", "13:30", "14:00"], nightHours: ["20:00", "20:30", "21:00"], weekdayOpen: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true }, dailyLimit: 50, mesasDeDosLimit: "10", mesasDeTresLimit: "5" },
    floors: [{ date: "", floor_number: 1, active: true }, { date: "", floor_number: 2, active: true }],
    restaurantInfo: { name: "Alqueria Villa Carmen", address: "Camí de la Font, 15, 46025 Valencia", phone: "+34 961 234 567", email: "reservas@alqueriavillacarmen.com" },
    error: null,
  }),
};
