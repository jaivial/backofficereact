import type { Meta, StoryObj } from "@storybook/react";
import { MobileActionButton } from "./MobileActionButton";

const meta = {
  title: "ui/mobile/MobileActionButton",
  component: MobileActionButton,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "destructive", "ghost"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "full"],
    },
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MobileActionButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
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

export const Destructive: Story = {
  name: "Destructive",
  args: {
    variant: "destructive",
    children: "Delete",
  },
};

export const Ghost: Story = {
  name: "Ghost",
  args: {
    variant: "ghost",
    children: "Cancel",
  },
};

export const FullWidth: Story = {
  name: "Full Width",
  args: {
    size: "full",
    children: "Full Width Button",
  },
};

export const Loading: Story = {
  name: "Loading",
  args: {
    loading: true,
    children: "Loading",
  },
};
