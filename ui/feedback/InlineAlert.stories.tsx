import type { Meta, StoryObj } from "@storybook/react";
import { InlineAlert } from "./InlineAlert";

const meta = {
  title: "ui/feedback/InlineAlert",
  component: InlineAlert,
  tags: ["autodocs"],
  argTypes: {
    kind: {
      control: "select",
      options: ["error", "success", "info"],
    },
    title: { control: "text" },
    message: { control: "text" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof InlineAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    kind: "info",
    title: "Information",
    message: "This is an informational message.",
  },
};

export const Error: Story = {
  name: "Error",
  args: {
    kind: "error",
    title: "Error",
    message: "Something went wrong. Please try again.",
  },
};

export const Success: Story = {
  name: "Success",
  args: {
    kind: "success",
    title: "Success",
    message: "Operation completed successfully.",
  },
};

export const WithoutMessage: Story = {
  name: "Without Message",
  args: {
    kind: "info",
    title: "Title Only",
  },
};
