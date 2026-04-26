import type { Meta, StoryObj } from "@storybook/react";
import { StatCard } from "./StatCard";

const meta = {
  title: "ui/widgets/StatCard",
  component: StatCard,
  tags: ["autodocs"],
  argTypes: {
    icon: {
      control: "select",
      options: ["calendar", "check", "clock", "users", "file-text", "trending-up"],
    },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    label: "Reservations",
    value: "24",
    icon: "calendar",
  },
};

export const Users: Story = {
  name: "Users",
  args: {
    label: "Active Users",
    value: "156",
    icon: "users",
  },
};

export const Clickable: Story = {
  name: "Clickable",
  args: {
    label: "Revenue",
    value: "€1,234",
    icon: "trending-up",
    onClick: () => {},
  },
};
