import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";

const meta = {
  title: "ui/shell/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "glass", "tailwind"],
    },
    padding: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    variant: "default",
    padding: true,
    children: <p>Card content</p>,
  },
};

export const Glass: Story = {
  name: "Glass",
  args: {
    variant: "glass",
    padding: true,
    children: <p>Glass card content</p>,
  },
};

export const WithHeader: Story = {
  name: "With Header",
  args: {
    variant: "default",
    header: <strong>Card Header</strong>,
    children: <p>Card content</p>,
  },
};

export const WithHeaderAndFooter: Story = {
  name: "With Header and Footer",
  args: {
    variant: "default",
    header: <strong>Header</strong>,
    footer: <small>Footer content</small>,
    children: <p>Card content</p>,
  },
};
