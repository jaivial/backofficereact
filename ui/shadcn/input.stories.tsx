import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

const meta = {
  title: "ui/shadcn/Input",
  component: Input,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    placeholder: "Enter text...",
  },
};

export const WithValue: Story = {
  name: "With Value",
  args: {
    defaultValue: "Some entered text",
  },
};

export const Disabled: Story = {
  name: "Disabled",
  args: {
    placeholder: "Disabled input",
    disabled: true,
  },
};
