import type { Meta, StoryObj } from "@storybook/react";
import { Panel } from "./Panel";

const meta = {
  title: "ui/shell/Panel",
  component: Panel,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "glass"],
    },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    title: "Panel Title",
    children: <p>Panel content</p>,
  },
};

export const Glass: Story = {
  name: "Glass",
  args: {
    variant: "glass",
    title: "Glass Panel",
    children: <p>Panel content</p>,
  },
};

export const WithMeta: Story = {
  name: "With Meta",
  args: {
    title: "Panel with Meta",
    meta: "Additional information",
    children: <p>Panel content</p>,
  },
};
