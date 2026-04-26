import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

import { RoleCreateModal, type CreateRoleInput } from "./RoleCreateModal";

function createMockOnCreate() {
  return async (input: CreateRoleInput) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Role created:", input);
  };
}

const meta: Meta<typeof RoleCreateModal> = {
  title: "widgets/roles/RoleCreateModal",
  component: RoleCreateModal,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj<typeof RoleCreateModal>;

export const Default: Story = {
  args: {
    open: true,
    busy: false,
    actorImportance: 100,
    onClose: () => console.log("Modal closed"),
    onCreate: createMockOnCreate(),
  },
};

export const WithLowerImportance: Story = {
  args: {
    open: true,
    busy: false,
    actorImportance: 10,
    onClose: () => console.log("Modal closed"),
    onCreate: createMockOnCreate(),
  },
  name: "With Lower Importance",
};

export const Busy: Story = {
  args: {
    open: true,
    busy: true,
    actorImportance: 100,
    onClose: () => console.log("Modal closed"),
    onCreate: async () => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    },
  },
};

export const Closed: Story = {
  args: {
    open: false,
    busy: false,
    actorImportance: 100,
    onClose: () => console.log("Modal closed"),
    onCreate: createMockOnCreate(),
  },
};
