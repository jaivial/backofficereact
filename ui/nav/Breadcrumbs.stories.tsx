import type { Meta, StoryObj } from "@storybook/react";
import { Breadcrumbs } from "./Breadcrumbs";
import type { BreadcrumbItem } from "./Breadcrumbs";

const meta = {
  title: "ui/nav/Breadcrumbs",
  component: Breadcrumbs,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    items: [
      { label: "Home", href: "/" },
      { label: "Section", href: "/section" },
      { label: "Current Page" },
    ] as BreadcrumbItem[],
  },
};

export const Short: Story = {
  name: "Short",
  args: {
    items: [{ label: "Home" }] as BreadcrumbItem[],
  },
};
