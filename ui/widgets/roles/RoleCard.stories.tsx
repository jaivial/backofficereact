import type { Meta, StoryObj } from "@storybook/react";
import { RoleCard } from "./RoleCard";
import type { RoleCatalogItem } from "../../../api/types";

const mockRole: RoleCatalogItem = {
  id: 1,
  slug: "admin",
  label: "Administrador",
  level: 10,
  iconKey: "shield-user",
  permissions: [],
  createdAt: "",
  updatedAt: "",
};

const meta = {
  title: "ui/widgets/roles/RoleCard",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  render: () => (
    <RoleCard
      role={mockRole}
      usersCount={3}
      onOpen={() => {}}
    />
  ),
};
