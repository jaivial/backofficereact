import type { Meta, StoryObj } from "@storybook/react";
import { FoodDishCard } from "./FoodDishCard";

const meta = {
  title: "ui/widgets/food/FoodDishCard",
  component: FoodDishCard,
  tags: ["autodocs"],
  argTypes: {
    inactive: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FoodDishCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    title: "Paella Valenciana",
    primaryMeta: "Arroz",
    priceLabel: "15.00 EUR",
  },
};

export const WithImage: Story = {
  name: "With Image",
  args: {
    title: "Paella Valenciana",
    imageUrl: "https://images.unsplash.com/photo-1534080564583-6be75777b70a",
    primaryMeta: "Arroz",
    priceLabel: "15.00 EUR",
  },
};

export const Inactive: Story = {
  name: "Inactive",
  args: {
    title: "Gazpacho",
    primaryMeta: "Sopa fria",
    inactive: true,
  },
};
