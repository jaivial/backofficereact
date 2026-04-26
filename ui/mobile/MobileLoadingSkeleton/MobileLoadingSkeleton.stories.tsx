import type { Meta, StoryObj } from "@storybook/react";
import { MobileLoadingSkeleton } from "./MobileLoadingSkeleton";

const meta = {
  title: "ui/mobile/MobileLoadingSkeleton",
  component: MobileLoadingSkeleton,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["list", "card", "form"],
    },
    count: { control: "number" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MobileLoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Card: Story = {
  name: "Card",
  args: {
    type: "card",
    count: 3,
  },
};

export const List: Story = {
  name: "List",
  args: {
    type: "list",
    count: 4,
  },
};

export const Form: Story = {
  name: "Form",
  args: {
    type: "form",
    count: 1,
  },
};
