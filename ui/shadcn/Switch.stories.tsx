import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./Switch";

const meta = {
  title: "ui/shadcn/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {},
};

export const Checked: Story = {
  name: "Checked",
  args: {
    defaultChecked: true,
  },
};

export const Disabled: Story = {
  name: "Disabled",
  args: {
    disabled: true,
  },
};
