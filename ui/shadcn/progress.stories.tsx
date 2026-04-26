import type { Meta, StoryObj } from "@storybook/react";
import { Progress } from "./progress";

const meta = {
  title: "ui/shadcn/Progress",
  component: Progress,
  tags: ["autodocs"],
  argTypes: {
    value: { control: { type: "range", min: 0, max: 100 } },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    value: 50,
  },
};

export const Empty: Story = {
  name: "Empty",
  args: {
    value: 0,
  },
};

export const Full: Story = {
  name: "Full",
  args: {
    value: 100,
  },
};
