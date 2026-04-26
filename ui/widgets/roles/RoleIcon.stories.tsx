import type { Meta, StoryObj } from "@storybook/react";
import { RoleIcon } from "./RoleIcon";

const meta = {
  title: "ui/widgets/roles/RoleIcon",
  component: RoleIcon,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "number" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof RoleIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    roleSlug: "admin",
  },
};

export const WithIconKey: Story = {
  name: "With Icon Key",
  args: {
    roleSlug: "admin",
    iconKey: "crown",
  },
};
