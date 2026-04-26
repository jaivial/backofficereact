import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Miembro", pathname: "/app/miembros/1", data },
});

const meta = {
  title: "Pages/Miembros/Detalle",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty",
  parameters: shell({
    member: null,
    stats: null,
    timeBalance: null,
    schedules: [],
    error: null,
  }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    member: { id: 1, firstName: "Pedro", lastName: "Martinez", roleSlug: "jefe_cocina", email: "pedro@villacarmen.local", dni: "12345678A", phone: "+34600000001", photoUrl: null, boUserId: 1, active: true, weeklyContractHours: 40 },
    stats: null,
    timeBalance: null,
    schedules: [],
    error: null,
  }),
};
