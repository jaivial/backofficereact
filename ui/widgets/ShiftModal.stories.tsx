import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within, expect } from "@storybook/test";
import { ShiftModal } from "./ShiftModal";
import type { Member, FichajeSchedule, FichajeActiveEntry } from "../../api/types";

const testMember: Member = {
  id: 1,
  boUserId: 1,
  firstName: "Juan",
  lastName: "Garcia",
  email: "juan.garcia@example.com",
  dni: "12345678A",
  bankAccount: "ES9121000418450200051332",
  phone: "+34612345678",
  whatsappNumber: "+34612345678",
  photoUrl: null,
  weeklyContractHours: 40,
};

const testSchedule: FichajeSchedule = {
  id: 1,
  memberId: 1,
  memberName: "Juan Garcia",
  date: "2026-04-26",
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: 60,
  updatedAt: "2026-04-26T08:00:00Z",
};

const testActiveEntry: FichajeActiveEntry = {
  id: 1,
  memberId: 1,
  memberName: "Juan Garcia",
  workDate: "2026-04-26",
  startTime: "09:15",
  startAtIso: "2026-04-26T09:15:00Z",
};

const meta = {
  title: "ui/widgets/ShiftModal",
  component: ShiftModal,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    open: { control: "boolean" },
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: "400px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ShiftModal>;

export default meta;
type Story = StoryObj<typeof meta>;

// Base args that are common to all stories
const baseArgs = {
  open: true,
  member: testMember,
  date: "2026-04-26",
  onClose: () => console.log("Modal closed"),
  onSuccess: () => console.log("Operation successful"),
};

export const WithExistingSchedule: Story = {
  name: "With Existing Schedule",
  args: {
    ...baseArgs,
    schedule: testSchedule,
    activeEntry: undefined,
  },
};

export const WithExistingScheduleAndActiveEntry: Story = {
  name: "With Existing Schedule and Active Entry",
  args: {
    ...baseArgs,
    schedule: testSchedule,
    activeEntry: testActiveEntry,
  },
};

export const NoScheduleInitial: Story = {
  name: "No Schedule - Initial State",
  args: {
    ...baseArgs,
    schedule: undefined,
    activeEntry: undefined,
  },
};

export const NoScheduleShowAssignForm: Story = {
  name: "No Schedule - Show Assign Form",
  args: {
    ...baseArgs,
    schedule: undefined,
    activeEntry: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const assignButton = canvas.getByTestId("shift-modal-show-assign-form-btn");
    await userEvent.click(assignButton);
  },
};

export const NoScheduleAssignedSuccessfully: Story = {
  name: "No Schedule - Assigned Successfully",
  args: {
    ...baseArgs,
    schedule: testSchedule,
    activeEntry: undefined,
  },
};

export const ActiveShift: Story = {
  name: "Active Shift",
  args: {
    ...baseArgs,
    schedule: undefined,
    activeEntry: testActiveEntry,
  },
};

export const WithError: Story = {
  name: "With Error Message",
  args: {
    ...baseArgs,
    schedule: testSchedule,
    activeEntry: undefined,
  },
  play: async ({ canvasElement }) => {
    // Try to update the schedule which will trigger an error due to mock API
    const canvas = within(canvasElement);
    const updateButton = canvas.getByTestId("shift-modal-update-btn");
    await userEvent.click(updateButton);
    // Wait for error to appear
    await expect(canvas.getByTestId("shift-modal-error")).toBeVisible();
  },
};

export const AdjustStartTime: Story = {
  name: "Adjust Start Time",
  args: {
    ...baseArgs,
    schedule: testSchedule,
    activeEntry: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the minus button for start time
    const decrementButton = canvas.getByTestId("shift-modal-decrement-start-btn");
    await userEvent.click(decrementButton);
    // Verify time changed (should show 08:45 now)
    const startTime = canvas.getByTestId("shift-modal-start-time");
    await expect(startTime).toHaveTextContent("08:45");
  },
};

export const AdjustEndTime: Story = {
  name: "Adjust End Time",
  args: {
    ...baseArgs,
    schedule: testSchedule,
    activeEntry: undefined,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Click the plus button for end time
    const incrementButton = canvas.getByTestId("shift-modal-increment-end-btn");
    await userEvent.click(incrementButton);
    // Verify time changed (should show 17:15 now)
    const endTime = canvas.getByTestId("shift-modal-end-time");
    await expect(endTime).toHaveTextContent("17:15");
  },
};

export const ClosedModal: Story = {
  name: "Closed Modal",
  args: {
    ...baseArgs,
    open: false,
    schedule: testSchedule,
    activeEntry: undefined,
  },
};
