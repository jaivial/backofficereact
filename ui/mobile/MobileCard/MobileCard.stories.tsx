import type { Meta, StoryObj } from "@storybook/react";
import { MobileCard } from "./MobileCard";

const meta = {
  title: "ui/mobile/MobileCard",
  component: MobileCard,
  tags: ["autodocs"],
  argTypes: {
    accent: {
      control: "select",
      options: ["primary", "success", "warning", "error"],
    },
    pressable: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MobileCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    children: <p>Mobile card content</p>,
  },
};

export const Pressable: Story = {
  name: "Pressable",
  args: {
    pressable: true,
    children: <p>Tap to interact</p>,
  },
};

export const WithAccent: Story = {
  name: "With Accent",
  args: {
    accent: "success",
    children: <p>Card with success accent</p>,
  },
};
