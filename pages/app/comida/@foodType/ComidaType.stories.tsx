import type { Meta, StoryObj } from "@storybook/react";
import Page from "./+Page";

const shell = (data: Record<string, unknown>) => ({
  layout: "fullscreen" as const,
  appShell: { title: "Carta - Platos", pathname: "/app/comida/platos", data },
});

const meta = {
  title: "Pages/Comida/Platos",
  component: Page,
  tags: ["autodocs"],
  parameters: shell({}),
} satisfies Meta<typeof Page>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  name: "Empty (no platos)",
  parameters: shell({
    foodType: "platos",
    items: [],
    total: 0,
    page: 1,
    limit: 50,
    categories: [],
    error: null,
  }),
};

export const Populated: Story = {
  name: "Populated",
  parameters: shell({
    foodType: "platos",
    items: [
      { num: 1, tipo: "PRINCIPAL", nombre: "Paella Valenciana", precio: 18, descripcion: "Paella tradicional con pollo y judiones", titulo: "", suplemento: 0, alergenos: ["gluten"], active: true, has_foto: true },
      { num: 2, tipo: "ENTRANTE", nombre: "Ensalada Mediterranea", precio: 12, descripcion: "Ensalada con tomate, aceitunas y queso", titulo: "", suplemento: 0, alergenos: [], active: true, has_foto: false },
      { num: 3, tipo: "PRINCIPAL", nombre: "Arroz con Bogavante", precio: 25, descripcion: "Arroz meloso con bogavante fresco", titulo: "", suplemento: 0, alergenos: ["crustaceos"], active: true, has_foto: true },
    ],
    total: 3,
    page: 1,
    limit: 50,
    categories: [],
    error: null,
  }),
};
