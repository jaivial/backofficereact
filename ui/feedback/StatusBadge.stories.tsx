import type { Meta, StoryObj } from "@storybook/react";
import { StatusBadge } from "./StatusBadge";

const meta = {
  title: "ui/feedback/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["success", "danger", "warning", "info", "neutral"],
    },
    size: {
      control: "select",
      options: ["sm", "md"],
    },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    variant: "neutral",
    size: "md",
    children: "Neutral",
  },
};

export const Success: Story = {
  name: "Success",
  args: {
    variant: "success",
    size: "md",
    children: "Success",
  },
};

export const Danger: Story = {
  name: "Danger",
  args: {
    variant: "danger",
    size: "md",
    children: "Danger",
  },
};

export const Warning: Story = {
  name: "Warning",
  args: {
    variant: "warning",
    size: "md",
    children: "Warning",
  },
};

export const Info: Story = {
  name: "Info",
  args: {
    variant: "info",
    size: "md",
    children: "Info",
  },
};

export const Small: Story = {
  name: "Small",
  args: {
    variant: "success",
    size: "sm",
    children: "Small Badge",
  },
};
