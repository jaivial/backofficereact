import type { Meta, StoryObj } from "@storybook/react";
import { NavLink } from "./NavLink";

const meta = {
  title: "ui/nav/NavLink",
  component: NavLink,
  tags: ["autodocs"],
  argTypes: {
    active: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof NavLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    href: "/page",
    label: "Navigation Link",
    active: false,
    children: "Link",
  },
};

export const Active: Story = {
  name: "Active",
  args: {
    href: "/page",
    label: "Navigation Link",
    active: true,
    children: "Link",
  },
};
