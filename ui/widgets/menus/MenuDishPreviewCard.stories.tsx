import type { Meta, StoryObj } from "@storybook/react";
import { MenuDishPreviewCard } from "./MenuDishPreviewCard";

const meta = {
  title: "ui/widgets/menus/MenuDishPreviewCard",
  component: MenuDishPreviewCard,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MenuDishPreviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    title: "Ensalada Mixta",
    description: "Lechuga, tomate, cebolla y aceitunas",
    price: 8.5,
  },
};

export const WithAllergens: Story = {
  name: "With Allergens",
  args: {
    title: "Tortilla Frances",
    description: "Huevos y patatas",
    allergens: ["Huevos", "Gluten"],
    price: 6.0,
  },
};

export const WithSupplement: Story = {
  name: "With Supplement",
  args: {
    title: "Cafe Especial",
    description: "Cafe con leche y canela",
    supplementEnabled: true,
    supplementPrice: 1.5,
  },
};
