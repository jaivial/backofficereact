import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

import type { Member, RoleCatalogItem, RoleUserItem } from "../../../api/types";
import { RoleDetailModal } from "./RoleDetailModal";

const mockRoles: RoleCatalogItem[] = [
  {
    slug: "owner",
    label: "Propietario",
    sortOrder: 1,
    importance: 100,
    level: 1,
    iconKey: "crown",
    isSystem: true,
    permissions: ["all", "manage_users", "manage_settings", "manage_bookings"],
  },
  {
    slug: "manager",
    label: "Gerente",
    sortOrder: 2,
    importance: 80,
    level: 2,
    iconKey: "briefcase",
    isSystem: true,
    permissions: ["manage_bookings", "view_reports", "manage_members"],
  },
  {
    slug: "staff",
    label: "Personal",
    sortOrder: 3,
    importance: 50,
    level: 3,
    iconKey: "user",
    isSystem: true,
    permissions: ["view_bookings", "checkin"],
  },
  {
    slug: "viewer",
    label: "Invitado",
    sortOrder: 4,
    importance: 20,
    level: 4,
    iconKey: "eye",
    isSystem: true,
    permissions: ["view_bookings"],
  },
];

const mockUsers: RoleUserItem[] = [
  { id: 1, email: "maria@restaurante.com", name: "Maria Garcia", role: "owner", roleImportance: 100 },
  { id: 2, email: "juan@restaurante.com", name: "Juan Lopez", role: "manager", roleImportance: 80 },
  { id: 3, email: "ana@restaurante.com", name: "Ana Martinez", role: "staff", roleImportance: 50 },
];

const mockMembers: Member[] = [
  { id: 1, boUserId: 1, firstName: "Maria", lastName: "Garcia", email: "maria@restaurante.com", dni: null, bankAccount: null, phone: null, whatsappNumber: null, photoUrl: null, weeklyContractHours: 40 },
  { id: 2, boUserId: 2, firstName: "Juan", lastName: "Lopez", email: "juan@restaurante.com", dni: null, bankAccount: null, phone: null, whatsappNumber: null, photoUrl: null, weeklyContractHours: 40 },
  { id: 3, boUserId: 3, firstName: "Ana", lastName: "Martinez", email: "ana@restaurante.com", dni: null, bankAccount: null, phone: null, whatsappNumber: null, photoUrl: null, weeklyContractHours: 40 },
  { id: 4, boUserId: null, firstName: "Pedro", lastName: "Rodriguez", email: "pedro@email.com", dni: null, bankAccount: null, phone: null, whatsappNumber: null, photoUrl: null, weeklyContractHours: 20 },
  { id: 5, boUserId: null, firstName: "Laura", lastName: "Fernandez", email: "laura@email.com", dni: null, bankAccount: null, phone: null, whatsappNumber: null, photoUrl: null, weeklyContractHours: 30 },
];

const mockManagerRole: RoleCatalogItem = mockRoles[1];

const meta = {
  title: "ui/widgets/roles/RoleDetailModal",
  component: RoleDetailModal,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof RoleDetailModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultArgs = {
  open: true,
  onClose: () => console.log("Modal closed"),
  roles: mockRoles,
  users: mockUsers,
  members: mockMembers,
  actorImportance: 100,
  busyUserId: null,
  busyAssign: false,
  onChangeUserRole: async (userId: number, nextRole: string) => {
    console.log(`User ${userId} assigned role: ${nextRole}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
  onAssignRoleToMembers: async (memberIds: number[], roleSlug: string) => {
    console.log(`Members ${memberIds} assigned role: ${roleSlug}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  },
};

export const Default: Story = {
  name: "Default - Manager Role",
  args: {
    ...defaultArgs,
    role: mockManagerRole,
  },
};

export const OwnerRole: Story = {
  name: "Owner Role",
  args: {
    ...defaultArgs,
    role: mockRoles[0],
    actorImportance: 100,
  },
};

export const StaffRole: Story = {
  name: "Staff Role",
  args: {
    ...defaultArgs,
    role: mockRoles[2],
  },
};

export const ViewerRole: Story = {
  name: "Viewer Role",
  args: {
    ...defaultArgs,
    role: mockRoles[3],
  },
};

export const EmptyRole: Story = {
  name: "Empty Role - No Members",
  args: {
    ...defaultArgs,
    role: mockManagerRole,
    users: mockUsers.filter((u) => u.role !== "manager"),
    members: mockMembers.map((m) => ({ ...m, boUserId: m.id === 1 ? 1 : null })),
  },
};

export const NoRoleSelected: Story = {
  name: "No Role Selected",
  args: {
    ...defaultArgs,
    role: null,
    open: true,
  },
};

export const WithBusyUser: Story = {
  name: "With Busy User",
  args: {
    ...defaultArgs,
    role: mockManagerRole,
    busyUserId: 2,
  },
};

export const WithBusyAssign: Story = {
  name: "With Busy Assign Operation",
  args: {
    ...defaultArgs,
    role: mockManagerRole,
    busyAssign: true,
  },
};

export const LimitedActorPermissions: Story = {
  name: "Limited Actor Permissions (Manager)",
  args: {
    ...defaultArgs,
    role: mockRoles[2],
    actorImportance: 80,
    users: mockUsers,
    members: mockMembers,
  },
};

export const MembersWithMissingEmails: Story = {
  name: "Members With Missing Emails",
  args: {
    ...defaultArgs,
    role: mockManagerRole,
    members: [
      ...mockMembers,
      { id: 6, boUserId: null, firstName: "Sin", lastName: "Email", email: null, dni: null, bankAccount: null, phone: null, whatsappNumber: null, photoUrl: null, weeklyContractHours: 20 },
      { id: 7, boUserId: null, firstName: "Tambien", lastName: "SinEmail", email: "", dni: null, bankAccount: null, phone: null, whatsappNumber: null, photoUrl: null, weeklyContractHours: 25 },
    ] as Member[],
  },
};

export const RoleWithManyPermissions: Story = {
  name: "Role With Many Permissions",
  args: {
    ...defaultArgs,
    role: {
      ...mockRoles[0],
      permissions: [
        "all",
        "manage_users",
        "manage_settings",
        "manage_bookings",
        "view_reports",
        "manage_members",
        "manage_menu",
        "manage_inventory",
        "view_analytics",
        "export_data",
        "manage_roles",
        "manage_permissions",
      ],
    },
  },
};

export const ClosedModal: Story = {
  name: "Closed Modal",
  args: {
    ...defaultArgs,
    role: mockManagerRole,
    open: false,
  },
};
