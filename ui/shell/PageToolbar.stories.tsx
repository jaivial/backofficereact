import type { Meta, StoryObj } from "@storybook/react";
import { PageToolbar } from "./PageToolbar";

const meta = {
  title: "ui/shell/PageToolbar",
  component: PageToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PageToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    left: <h1>Page Title</h1>,
    right: <button>Action</button>,
  },
};
