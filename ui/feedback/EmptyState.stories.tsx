import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";

const meta = {
  title: "ui/feedback/EmptyState",
  component: EmptyState,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "tailwind"],
    },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    variant: "default",
    title: "No data",
    description: "There are no items to display.",
  },
};

export const WithIcon: Story = {
  name: "With Icon",
  args: {
    variant: "default",
    icon: <span style={{ fontSize: "2rem" }}>📭</span>,
    title: "No messages",
    description: "Your inbox is empty.",
  },
};

export const TailwindVariant: Story = {
  name: "Tailwind Variant",
  args: {
    variant: "tailwind",
    title: "No results found",
    description: "Try adjusting your search criteria.",
  },
};
