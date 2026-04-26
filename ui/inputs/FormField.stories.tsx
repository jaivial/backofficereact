import type { Meta, StoryObj } from "@storybook/react";
import { FormField } from "./FormField";
import { Input } from "../shadcn/input";

const meta = {
  title: "ui/inputs/FormField",
  component: FormField,
  tags: ["autodocs"],
  argTypes: {
    required: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    label: "Email",
    htmlFor: "email",
    children: <Input id="email" type="email" placeholder="Enter email" />,
  },
};

export const Required: Story = {
  name: "Required",
  args: {
    label: "Password",
    htmlFor: "password",
    required: true,
    children: <Input id="password" type="password" placeholder="Enter password" />,
  },
};

export const WithError: Story = {
  name: "With Error",
  args: {
    label: "Email",
    htmlFor: "email-error",
    error: "This email is already in use.",
    children: <Input id="email-error" type="email" placeholder="Enter email" />,
  },
};
