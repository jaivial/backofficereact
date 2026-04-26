import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Roles", pathname: "/app/miembros/roles", data },
});

const meta = {
  title: "Pages/Miembros/Roles",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no roles)",
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
      { id: 1, firstName: "Pedro", lastName: "Martinez", roleSlug: "jefe_cocina", email: "pedro@villacarmen.local", active: true },
    ],
    roles: [
      { slug: "admin", label: "Admin", importance: 90, iconKey: "shield", permissions: ["reservas", "menus", "comida", "miembros", "horarios", "fichaje", "facturas"] },
      { slug: "jefe_cocina", label: "Jefe de cocina", importance: 60, iconKey: "utensils", permissions: ["reservas", "menus", "comida", "fichaje", "horarios"] },
    ],
    users: [{ id: 1, email: "pedro@villacarmen.local", name: "Pedro Martinez", role: "jefe_cocina" }],
    currentUser: { role: "admin", roleImportance: 90 },
    error: null,
  }),
};
