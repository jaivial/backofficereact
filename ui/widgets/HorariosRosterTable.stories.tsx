import type { Meta, StoryObj } from "@storybook/react";
import { HorariosRosterTable } from "./HorariosRosterTable";
import type { Member, FichajeSchedule, FichajeActiveEntry } from "../../api/types";

const meta: Meta<typeof HorariosRosterTable> = {
  title: "Widgets/HorariosRosterTable",
  component: HorariosRosterTable,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof HorariosRosterTable>;

// Sample members
const sampleMembers: Member[] = [
  {
    id: 1,
    boUserId: 101,
    firstName: "Maria",
    lastName: "Garcia",
    email: "maria.garcia@restaurant.com",
    dni: "12345678A",
    bankAccount: "ES9121000418450200051332",
    phone: "+34612345678",
    whatsappNumber: "+34612345678",
    photoUrl: null,
    weeklyContractHours: 40,
  },
  {
    id: 2,
    boUserId: 102,
    firstName: "Juan",
    lastName: "Martinez",
    email: "juan.martinez@restaurant.com",
    dni: "87654321B",
    bankAccount: null,
    phone: "+34698765432",
    whatsappNumber: null,
    photoUrl: null,
    weeklyContractHours: 30,
  },
  {
    id: 3,
    boUserId: 103,
    firstName: "Ana",
    lastName: "Lopez",
    email: "ana.lopez@restaurant.com",
    dni: "11223344C",
    bankAccount: "ES1234567890123456789012",
    phone: "+34655555555",
    whatsappNumber: "+34655555555",
    photoUrl: null,
    weeklyContractHours: 20,
  },
  {
    id: 4,
    boUserId: 104,
    firstName: "Carlos",
    lastName: "Rodriguez",
    email: "carlos.rodriguez@restaurant.com",
    dni: "55667788D",
    bankAccount: null,
    phone: null,
    whatsappNumber: null,
    photoUrl: null,
    weeklyContractHours: 40,
  },
  {
    id: 5,
    boUserId: 105,
    firstName: "Elena",
    lastName: "Fernandez",
    email: "elena.fernandez@restaurant.com",
    dni: "99887766E",
    bankAccount: "ES9988776655443322110099",
    phone: "+34644444444",
    whatsappNumber: "+34644444444",
    photoUrl: null,
    weeklyContractHours: 35,
  },
];

// Sample schedules
const sampleSchedules: FichajeSchedule[] = [
  {
    id: 1,
    memberId: 1,
    memberName: "Maria Garcia",
    date: "2024-04-26",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 30,
    updatedAt: "2024-04-25T10:00:00Z",
  },
  {
    id: 2,
    memberId: 2,
    memberName: "Juan Martinez",
    date: "2024-04-26",
    startTime: "14:00",
    endTime: "22:00",
    breakMinutes: 30,
    updatedAt: "2024-04-25T10:00:00Z",
  },
  {
    id: 3,
    memberId: 3,
    memberName: "Ana Lopez",
    date: "2024-04-26",
    startTime: "10:00",
    endTime: "16:00",
    breakMinutes: 30,
    updatedAt: "2024-04-25T10:00:00Z",
  },
];

// Sample active entries
const sampleActiveEntries: FichajeActiveEntry[] = [
  {
    id: 1,
    memberId: 1,
    memberName: "Maria Garcia",
    workDate: "2024-04-26",
    startTime: "09:00",
    startAtIso: "2024-04-26T09:00:00Z",
  },
  {
    id: 2,
    memberId: 3,
    memberName: "Ana Lopez",
    workDate: "2024-04-26",
    startTime: "10:15",
    startAtIso: "2024-04-26T10:15:00Z",
  },
];

const defaultHandlers = {
  onRowClick: (member: Member) => console.log("Row clicked:", member.firstName, member.lastName),
  onEditMember: (member: Member) => console.log("Edit member:", member.firstName, member.lastName),
};

// Default story with mix of members
export const Default: Story = {
  args: {
    rows: [
      { member: sampleMembers[0], schedule: sampleSchedules[0], activeEntry: sampleActiveEntries[0] },
      { member: sampleMembers[1], schedule: sampleSchedules[1], activeEntry: undefined },
      { member: sampleMembers[2], schedule: sampleSchedules[2], activeEntry: sampleActiveEntries[1] },
      { member: sampleMembers[3], schedule: undefined, activeEntry: undefined },
      { member: sampleMembers[4], schedule: sampleSchedules[0], activeEntry: undefined },
    ],
    selectedMemberId: null,
    emptyLabel: undefined,
    ...defaultHandlers,
  },
};

// Story showing all members working (active)
export const AllActive: Story = {
  args: {
    rows: [
      { member: sampleMembers[0], schedule: sampleSchedules[0], activeEntry: sampleActiveEntries[0] },
      { member: sampleMembers[1], schedule: sampleSchedules[1], activeEntry: sampleActiveEntries[1] },
      { member: sampleMembers[2], schedule: sampleSchedules[2], activeEntry: sampleActiveEntries[1] },
    ],
    selectedMemberId: sampleMembers[1].id,
    ...defaultHandlers,
  },
  parameters: {
    docs: {
      description: {
        story: "All team members currently working. Maria, Juan, and Ana have checked in and are actively working.",
      },
    },
  },
};

// Story showing members with mixed states
export const MixedStates: Story = {
  args: {
    rows: [
      { member: sampleMembers[0], schedule: sampleSchedules[0], activeEntry: sampleActiveEntries[0] },
      { member: sampleMembers[1], schedule: sampleSchedules[1], activeEntry: undefined },
      { member: sampleMembers[2], schedule: undefined, activeEntry: undefined },
    ],
    selectedMemberId: null,
    ...defaultHandlers,
  },
  parameters: {
    docs: {
      description: {
        story: "Mixed states: Maria is working, Juan has a shift scheduled but not checked in, and Carlos has no schedule assigned.",
      },
    },
  },
};

// Story with unassigned members
export const UnassignedMembers: Story = {
  args: {
    rows: [
      { member: sampleMembers[3], schedule: undefined, activeEntry: undefined },
      { member: sampleMembers[4], schedule: undefined, activeEntry: undefined },
    ],
    selectedMemberId: null,
    ...defaultHandlers,
  },
  parameters: {
    docs: {
      description: {
        story: "Team members without assigned schedules for today.",
      },
    },
  },
};

// Empty state story
export const Empty: Story = {
  args: {
    rows: [],
    selectedMemberId: null,
    emptyLabel: "No hay miembros en el roster para hoy",
    ...defaultHandlers,
  },
  parameters: {
    docs: {
      description: {
        story: "Empty state shown when no team members are available.",
      },
    },
  },
};

// Single member story
export const SingleMember: Story = {
  args: {
    rows: [
      { member: sampleMembers[0], schedule: sampleSchedules[0], activeEntry: sampleActiveEntries[0] },
    ],
    selectedMemberId: sampleMembers[0].id,
    ...defaultHandlers,
  },
  parameters: {
    docs: {
      description: {
        story: "Single team member working.",
      },
    },
  },
};
