import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Plato detalle", pathname: "/app/comida/platos/1", data },
});

const meta = {
  title: "Pages/Comida/Detalle",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no data)",
  parameters: shell({ foodType: "platos", foodId: "1", item: null, error: null }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    foodType: "platos",
    foodId: "1",
    item: { num: 1, tipo: "PRINCIPAL", nombre: "Paella Valenciana", precio: 18, descripcion: "Paella tradicional con pollo, judiones y garrofon. Elaborada con arroz bomba de la Albufera.", titulo: "", suplemento: 0, alergenos: ["gluten", "huevos"], active: true, has_foto: true },
    error: null,
  }),
};
