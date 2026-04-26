import type { Meta, StoryObj } from "@storybook/react";
import { Accordion } from "./Accordion";

const meta = {
  title: "ui/overlays/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  argTypes: {
    defaultOpen: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Accordion>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    title: "Accordion Title",
    defaultOpen: false,
    children: <p>Accordion content goes here.</p>,
  },
};

export const Open: Story = {
  name: "Open",
  args: {
    title: "Accordion Title",
    defaultOpen: true,
    children: <p>Accordion content goes here.</p>,
  },
};
