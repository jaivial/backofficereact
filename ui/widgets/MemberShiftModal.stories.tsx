import type { Meta, StoryObj } from "@storybook/react";
import React, { useState, useCallback } from "react";

import { MemberShiftModal } from "./MemberShiftModal";
import type { Member, FichajeSchedule, TimeEntry } from "../../api/types";

// Mock member data
const mockMember: Member = {
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
};

// Mock schedule data
const mockSchedule: FichajeSchedule = {
  id: 1,
  memberId: 1,
  memberName: "Maria Garcia",
  date: "2026-04-26",
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: 60,
  updatedAt: "2026-04-26T08:00:00Z",
};

// Mock active time entry
const mockActiveEntry: TimeEntry = {
  id: 1,
  memberId: 1,
  memberName: "Maria Garcia",
  workDate: "2026-04-26",
  startTime: "09:00",
  endTime: null,
  minutesWorked: 0,
  source: "admin",
};

const meta = {
  title: "ui/widgets/MemberShiftModal",
  component: MemberShiftModal,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "Modal for managing member shift assignments and time tracking (fichaje). Shows different states based on whether the member has a schedule assigned and whether they are currently working.",
      },
    },
    backgrounds: {
      default: "dark",
    },
  },
  argTypes: {
    open: { control: "boolean" },
    selectedDate: { control: "date" },
  },
} satisfies Meta<typeof MemberShiftModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Wrapper component that provides mock API responses using fetch interception.
 * This intercepts the API calls at the network level.
 */
function MockMemberShiftModal({
  member,
  selectedDate,
  schedules = [mockSchedule],
  entries = [] as TimeEntry[],
}: {
  member: Member;
  selectedDate: string;
  schedules?: FichajeSchedule[];
  entries?: TimeEntry[];
}) {
  const [open, setOpen] = useState(true);

  // Set up fetch interceptor on mount
  const originalFetch = window.fetch;

  // Set up the mock API responses
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    // Mock horarios list endpoint
    if (url.includes("/api/admin/horarios")) {
      return new Response(JSON.stringify({
        success: true,
        date: selectedDate,
        schedules,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mock fichaje entries list endpoint
    if (url.includes("/api/admin/fichaje/entries")) {
      return new Response(JSON.stringify({
        success: true,
        date: selectedDate,
        memberId: member.id,
        entries,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mock horarios update
    if (url.includes("/api/admin/horarios/") && init?.method === "PUT") {
      return new Response(JSON.stringify({
        success: true,
        schedule: mockSchedule,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mock horarios delete
    if (url.includes("/api/admin/horarios/") && init?.method === "DELETE") {
      return new Response(JSON.stringify({
        success: true,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mock horarios assign
    if (url.includes("/api/admin/horarios") && init?.method === "POST") {
      return new Response(JSON.stringify({
        success: true,
        schedule: mockSchedule,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mock admin start/stop
    if (url.includes("/api/admin/fichaje/admin/")) {
      return new Response(JSON.stringify({
        success: true,
        activeEntry: url.includes("start") ? mockActiveEntry : null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fall through to original fetch
    return originalFetch(input, init);
  };

  return (
    <div data-slot="memberShiftModal.stories-div" style={{ padding: "20px", minWidth: "400px" }}>
      <MemberShiftModal
        member={member}
        selectedDate={selectedDate}
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

// Story: No schedule assigned
export const NoSchedule: Story = {
  name: "No Schedule Assigned",
  parameters: {
    docs: {
      description: {
        story: "Modal state when the member has no shift assigned for the selected date. Shows option to assign a new shift.",
      },
    },
  },
  render: () => (
    <MockMemberShiftModal
      member={mockMember}
      selectedDate="2026-04-26"
      schedules={[]}
      entries={[]}
    />
  ),
};

// Story: Has schedule, not active
export const HasScheduleNotActive: Story = {
  name: "Has Schedule - Not Active",
  parameters: {
    docs: {
      description: {
        story: "Modal state when member has a shift assigned but is not currently working (fichaje not started). Allows time adjustment and starting fichaje.",
      },
    },
  },
  render: () => (
    <MockMemberShiftModal
      member={mockMember}
      selectedDate="2026-04-26"
      schedules={[mockSchedule]}
      entries={[]}
    />
  ),
};

// Story: Has schedule, is active (working)
export const HasScheduleIsActive: Story = {
  name: "Has Schedule - Active (Working)",
  parameters: {
    docs: {
      description: {
        story: "Modal state when member is currently working (fichaje started). Shows active badge and allows stopping fichaje.",
      },
    },
  },
  render: () => (
    <MockMemberShiftModal
      member={mockMember}
      selectedDate="2026-04-26"
      schedules={[mockSchedule]}
      entries={[mockActiveEntry]}
    />
  ),
};

// Story: Interactive with state controls
export const Interactive: Story = {
  name: "Interactive",
  parameters: {
    docs: {
      description: {
        story: "Interactive story with controls to toggle between different states. Changes will take effect when the modal is reopened.",
      },
    },
  },
  render: () => {
    const [hasSchedule, setHasSchedule] = useState(true);
    const [isActive, setIsActive] = useState(false);

    return (
      <div data-slot="memberShiftModal.stories-div" style={{ padding: "20px", fontFamily: "system-ui", minWidth: "500px" }}>
        <div data-slot="memberShiftModal.stories-div"
          style={{
            background: "#f5f5f5",
            padding: "12px",
            borderRadius: "4px",
            marginBottom: "16px",
          }}
        >
          <h4 data-slot="memberShiftModal.stories-h4" style={{ margin: "0 0 8px 0", fontSize: "14px" }}>State Controls (reopen modal to apply):</h4>
          <label data-slot="memberShiftModal.stories-label" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <input data-testid="input-checkbox"
              type="checkbox"
              checked={hasSchedule}
              onChange={(e) => setHasSchedule(e.target.checked)}
            />
            Has Schedule
          </label>
          <label data-slot="memberShiftModal.stories-label" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input data-testid="input-checkbox-2"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={!hasSchedule}
            />
            Is Active (Working)
          </label>
        </div>

        <div data-slot="memberShiftModal.stories-div"
          style={{
            background: "#e8f5e9",
            padding: "12px",
            borderRadius: "4px",
            fontSize: "12px",
            fontFamily: "monospace",
          }}
        >
          <h4 data-slot="memberShiftModal.stories-h4" style={{ margin: "0 0 8px 0", fontSize: "14px" }}>Actions Available in Modal:</h4>
          <ul data-slot="memberShiftModal.stories-ul" style={{ margin: 0, paddingLeft: "20px" }}>
            <li data-slot="memberShiftModal.stories-li">Start fichaje - changes to active state</li>
            <li data-slot="memberShiftModal.stories-li">Stop fichaje - returns to not active</li>
            <li data-slot="memberShiftModal.stories-li">Remove shift - clears schedule</li>
            <li data-slot="memberShiftModal.stories-li">Assign shift - creates schedule</li>
            <li data-slot="memberShiftModal.stories-li">Adjust time - updates schedule times</li>
          </ul>
        </div>

        <MockMemberShiftModal
          member={mockMember}
          selectedDate="2026-04-26"
          schedules={hasSchedule ? [mockSchedule] : []}
          entries={isActive ? [mockActiveEntry] : []}
        />
      </div>
    );
  },
};

// Story: Closed modal
export const Closed: Story = {
  name: "Closed",
  parameters: {
    docs: {
      description: {
        story: "Modal in closed state (open=false). This is the default state when the modal should not be visible.",
      },
    },
  },
  render: () => {
    const [open, setOpen] = useState(false);

    return (
      <div data-slot="memberShiftModal.stories-div" style={{ padding: "40px", color: "#888", textAlign: "center" }}>
        <button data-testid="open-modal"
          onClick={() => setOpen(true)}
          style={{
            padding: "8px 16px",
            background: "#0066cc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            marginBottom: "16px",
          }}
        >
          Open Modal
        </button>
        <p data-slot="memberShiftModal.stories-p">Modal is closed.</p>
        <p data-slot="memberShiftModal.stories-p" style={{ fontSize: "12px" }}>Select a different story variant to see different modal states.</p>
        <div data-slot="memberShiftModal.stories-div" style={{ marginTop: "20px" }}>
          <MemberShiftModal
            member={mockMember}
            selectedDate="2026-04-26"
            open={open}
            onClose={() => setOpen(false)}
          />
        </div>
      </div>
    );
  },
};
