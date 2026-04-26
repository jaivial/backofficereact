import type { Meta, StoryObj } from "@storybook/react";
import { RoleBadge } from "./RoleBadge";

const meta = {
  title: "ui/widgets/roles/RoleBadge",
  component: RoleBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof RoleBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    roleSlug: "admin",
  },
};

export const WithImportance: Story = {
  name: "With Importance",
  args: {
    roleSlug: "jefe_cocina",
    importance: 5,
  },
};
