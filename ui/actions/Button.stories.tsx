import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta = {
  title: "ui/actions/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "ghost", "danger"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
    disabled: { control: "boolean" },
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
    variant: "secondary",
    size: "md",
    children: "Button",
  },
};

export const Primary: Story = {
  name: "Primary",
  args: {
    variant: "primary",
    size: "md",
    children: "Primary Button",
  },
};

export const Secondary: Story = {
  name: "Secondary",
  args: {
    variant: "secondary",
    size: "md",
    children: "Secondary Button",
  },
};

export const Ghost: Story = {
  name: "Ghost",
  args: {
    variant: "ghost",
    size: "md",
    children: "Ghost Button",
  },
};

export const Danger: Story = {
  name: "Danger",
  args: {
    variant: "danger",
    size: "md",
    children: "Danger Button",
  },
};

export const Small: Story = {
  name: "Small",
  args: {
    variant: "primary",
    size: "sm",
    children: "Small Button",
  },
};

export const Large: Story = {
  name: "Large",
  args: {
    variant: "primary",
    size: "lg",
    children: "Large Button",
  },
};

export const Disabled: Story = {
  name: "Disabled",
  args: {
    variant: "primary",
    size: "md",
    disabled: true,
    children: "Disabled Button",
  },
};
