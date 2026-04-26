import type { Meta, StoryObj } from "@storybook/react";
import { DatePicker } from "./DatePicker";

const meta = {
  title: "ui/inputs/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    value: "2024-01-15",
    onChange: () => {},
  },
};

export const Disabled: Story = {
  name: "Disabled",
  args: {
    value: "2024-01-15",
    onChange: () => {},
    disabled: true,
  },
};
