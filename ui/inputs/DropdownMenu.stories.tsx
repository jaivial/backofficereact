import type { Meta, StoryObj } from "@storybook/react";
import { DropdownMenu } from "./DropdownMenu";
import type { MenuItem } from "./DropdownMenu";

const items: MenuItem[] = [
  { id: "edit", label: "Edit", onSelect: () => {} },
  { id: "delete", label: "Delete", tone: "danger", onSelect: () => {} },
];

const meta = {
  title: "ui/inputs/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DropdownMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    label: "Actions",
    items,
  },
};
