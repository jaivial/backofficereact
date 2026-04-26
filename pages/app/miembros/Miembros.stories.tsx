import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Miembros", pathname: "/app/miembros", data },
});

const meta = {
  title: "Pages/Miembros",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no members)",
  parameters: shell({
    members: [],
    roles: [],
    users: [],
    currentUser: { role: "admin", roleImportance: 90 },
    error: null,
  }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    members: [
      { id: 1, firstName: "Pedro", lastName: "Martinez", roleSlug: "jefe_cocina", email: "pedro@villacarmen.local", dni: "12345678A", phone: "+34600000001", photoUrl: null, boUserId: 1, active: true, weeklyContractHours: 40 },
      { id: 2, firstName: "Ana", lastName: "Sanchez", roleSlug: "camarero", email: "ana@villacarmen.local", dni: "87654321B", phone: "+34600000002", photoUrl: null, boUserId: 2, active: true, weeklyContractHours: 35 },
      { id: 3, firstName: "Luis", lastName: "Garcia", roleSlug: "arrocero", email: "luis@villacarmen.local", dni: null, phone: null, photoUrl: null, boUserId: null, active: true, weeklyContractHours: 40 },
    ],
    roles: [
      { slug: "jefe_cocina", label: "Jefe de cocina", importance: 60, iconKey: "utensils", permissions: ["reservas", "menus", "comida", "fichaje", "horarios"] },
      { slug: "camarero", label: "Camarero", importance: 40, iconKey: "users", permissions: ["fichaje", "horarios"] },
      { slug: "arrocero", label: "Arrocero", importance: 30, iconKey: "flame", permissions: ["fichaje", "horarios"] },
    ],
    users: [
      { id: 1, email: "pedro@villacarmen.local", name: "Pedro Martinez", role: "jefe_cocina" },
      { id: 2, email: "ana@villacarmen.local", name: "Ana Sanchez", role: "camarero" },
    ],
    currentUser: { role: "admin", roleImportance: 90 },
    error: null,
  }),
};
