import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";

const meta = {
  title: "ui/shadcn/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost"],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    variant: "default",
    size: "default",
    children: "Button",
  },
};

export const Secondary: Story = {
  name: "Secondary",
  args: {
    variant: "secondary",
    children: "Secondary",
  },
};

export const Outline: Story = {
  name: "Outline",
  args: {
    variant: "outline",
    children: "Outline",
  },
};

export const Ghost: Story = {
  name: "Ghost",
  args: {
    variant: "ghost",
    children: "Ghost",
  },
};

export const Small: Story = {
  name: "Small",
  args: {
    size: "sm",
    children: "Small",
  },
};

export const Large: Story = {
  name: "Large",
  args: {
    size: "lg",
    children: "Large",
  },
};
