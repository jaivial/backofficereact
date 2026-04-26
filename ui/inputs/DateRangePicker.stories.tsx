import type { Meta, StoryObj } from "@storybook/react";
import { DateRangePicker } from "./DateRangePicker";

const meta = {
  title: "ui/inputs/DateRangePicker",
  component: DateRangePicker,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DateRangePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    from: "2024-01-01",
    to: "2024-01-15",
    onChange: () => {},
  },
};

export const EmptyRange: Story = {
  name: "Empty Range",
  args: {
    from: "",
    to: "",
    onChange: () => {},
  },
};

export const SingleDay: Story = {
  name: "Single Day",
  args: {
    from: "2024-01-15",
    to: "2024-01-15",
    onChange: () => {},
  },
};
