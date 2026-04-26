import type { Meta, StoryObj } from "@storybook/react";
import { TimePicker } from "./TimePicker";

const meta = {
  title: "ui/inputs/TimePicker",
  component: TimePicker,
  tags: ["autodocs"],
  argTypes: {
    stepMinutes: { control: "number" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof TimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    value: "14:30",
    onChange: () => {},
  },
};

export const FifteenMinuteSteps: Story = {
  name: "15 Minute Steps",
  args: {
    value: "14:30",
    onChange: () => {},
    stepMinutes: 15,
  },
};

export const ThirtyMinuteSteps: Story = {
  name: "30 Minute Steps",
  args: {
    value: "14:00",
    onChange: () => {},
    stepMinutes: 30,
  },
};
