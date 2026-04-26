import type { Meta, StoryObj } from "@storybook/react";
import { DateDropdown } from "./DateDropdown";

const meta = {
  title: "ui/inputs/DateDropdown",
  component: DateDropdown,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DateDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    value: "2024-01-15",
    onChange: () => {},
  },
};
