import type { Meta, StoryObj } from "@storybook/react";
import { Label } from "./label";

const meta = {
  title: "ui/shadcn/Label",
  component: Label,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    children: "Label text",
  },
};

export const WithHtmlFor: Story = {
  name: "With HtmlFor",
  args: {
    htmlFor: "input-id",
    children: "Email Address",
  },
};
