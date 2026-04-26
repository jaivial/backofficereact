import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Reservas", pathname: "/app/reservas", data },
});

const meta = {
  title: "Pages/Reservas",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no bookings)",
  parameters: shell({
    date: "2026-04-26",
    bookings: [],
    floors: [],
    total_count: 0,
    page: 1,
    count: 15,
    calendarDays: [],
    dailyLimit: null,
    metrics: null,
    day: null,
    error: null,
  }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    date: "2026-04-26",
    bookings: [
      { id: 1, customer_name: "Juan Garcia", contact_email: "juan@example.com", reservation_date: "2026-04-26", reservation_time: "13:00", party_size: 4, children: 0, contact_phone: "+34600000001", contact_phone_country_code: "+34", status: "confirmed", arroz_type: null, arroz_servings: null, commentary: null, babyStrollers: 0, highChairs: 0, table_number: null, preferred_floor_number: null, added_date: "2026-04-25", special_menu: false, menu_de_grupo_id: null, principales_json: null },
      { id: 2, customer_name: "Maria Lopez", contact_email: "maria@example.com", reservation_date: "2026-04-26", reservation_time: "14:00", party_size: 2, children: 0, contact_phone: "+34600000002", contact_phone_country_code: "+34", status: "pending", arroz_type: null, arroz_servings: null, commentary: "Mesa ventana", babyStrollers: 0, highChairs: 0, table_number: null, preferred_floor_number: null, added_date: "2026-04-25", special_menu: false, menu_de_grupo_id: null, principales_json: null },
      { id: 3, customer_name: "Carlos Ruiz", contact_email: "carlos@example.com", reservation_date: "2026-04-26", reservation_time: "13:30", party_size: 6, children: 1, contact_phone: "+34600000003", contact_phone_country_code: "+34", status: "confirmed", arroz_type: "arroz_bomba", arroz_servings: "3", commentary: "Alergia a frutos secos", babyStrollers: 0, highChairs: 1, table_number: null, preferred_floor_number: null, added_date: "2026-04-24", special_menu: true, menu_de_grupo_id: null, principales_json: null },
    ],
    floors: [{ date: "2026-04-26", floor_number: 1, active: true }],
    total_count: 3,
    page: 1,
    count: 15,
    calendarDays: [{ date: "2026-04-26", booking_count: 3, total_people: 12, limit: 50, is_open: true }],
    dailyLimit: { date: "2026-04-26", limit: 50 },
    metrics: { date: "2026-04-26", total: 3, pending: 1, confirmed: 2, cancelled: 0, totalPeople: 12 },
    day: { date: "2026-04-26", is_open: true },
    error: null,
  }),
};
