import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "./Select";

const options = [
  { value: "option1", label: "Option 1" },
  { value: "option2", label: "Option 2" },
  { value: "option3", label: "Option 3" },
];

const meta = {
  title: "ui/inputs/Select",
  component: Select,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md"],
    },
    disabled: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    value: "option1",
    onChange: () => {},
    options,
    ariaLabel: "Select an option",
  },
};

export const Small: Story = {
  name: "Small",
  args: {
    value: "option1",
    onChange: () => {},
    options,
    size: "sm",
    ariaLabel: "Select an option",
  },
};

export const Disabled: Story = {
  name: "Disabled",
  args: {
    value: "option1",
    onChange: () => {},
    options,
    disabled: true,
    ariaLabel: "Select an option",
  },
};
