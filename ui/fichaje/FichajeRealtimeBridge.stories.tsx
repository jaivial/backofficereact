import type { Meta, StoryObj } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";

import { FichajeRealtimeBridge } from "./FichajeRealtimeBridge";
import type { FichajeActiveEntry, FichajeSchedule, FichajeState, FichajeMemberRef } from "../../api/types";
import type { FichajeRealtimeState } from "../../state/atoms";

// Mock atoms for Storybook
const mockSessionAtom = atom({
  user: { id: 1, email: "test@example.com", name: "Test User", role: "admin" as const, roleImportance: 100, sectionAccess: [] },
  restaurants: [{ id: 1, slug: "test", name: "Test Restaurant" }],
  activeRestaurantId: 1,
});

const mockFichajeRealtimeAtom = atom<FichajeRealtimeState>({
  wsConnected: false,
  wsConnecting: false,
  restaurantId: null,
  lastSyncAt: null,
  member: null,
  activeEntriesByMember: {},
  activeEntry: null,
  scheduleToday: null,
  pendingScheduleUpdates: false,
});

// Component that displays the realtime state for visualization
function RealtimeStateDisplay() {
  const state = useAtomValue(mockFichajeRealtimeAtom);

  return (
    <div data-slot="fichajeRealtimeBridge.stories-div" style={{ padding: "20px", fontFamily: "monospace", fontSize: "14px" }}>
      <h3 data-slot="fichajeRealtimeBridge.stories-h3" style={{ marginBottom: "16px" }}>Fichaje Realtime State</h3>
      <div data-slot="fichajeRealtimeBridge.stories-div" style={{ display: "grid", gap: "8px" }}>
        <div data-slot="fichajeRealtimeBridge.stories-div">
          <strong>WebSocket Connected:</strong>{" "}
          <span data-slot="fichajeRealtimeBridge.stories-span" style={{ color: state.wsConnected ? "green" : "red" }}>
            {state.wsConnected ? "YES" : "NO"}
          </span>
        </div>
        <div data-slot="fichajeRealtimeBridge.stories-div">
          <strong>WebSocket Connecting:</strong>{" "}
          <span data-slot="fichajeRealtimeBridge.stories-span" style={{ color: state.wsConnecting ? "orange" : "gray" }}>
            {state.wsConnecting ? "YES" : "NO"}
          </span>
        </div>
        <div data-slot="fichajeRealtimeBridge.stories-div">
          <strong>Restaurant ID:</strong> {state.restaurantId ?? "null"}
        </div>
        <div data-slot="fichajeRealtimeBridge.stories-div">
          <strong>Last Sync:</strong>{" "}
          {state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleTimeString() : "null"}
        </div>
        <div data-slot="fichajeRealtimeBridge.stories-div">
          <strong>Current Member:</strong>{" "}
          {state.member ? `${state.member.id} - ${state.member.fullName}` : "null"}
        </div>
        <div data-slot="fichajeRealtimeBridge.stories-div">
          <strong>Active Entries Count:</strong> {Object.keys(state.activeEntriesByMember).length}
        </div>
        <div data-slot="fichajeRealtimeBridge.stories-div">
          <strong>Active Entry (own):</strong>{" "}
          {state.activeEntry ? `Entry #${state.activeEntry.id} - ${state.activeEntry.memberName}` : "null"}
        </div>
        <div data-slot="fichajeRealtimeBridge.stories-div">
          <strong>Schedule Today:</strong>{" "}
          {state.scheduleToday
            ? `${state.scheduleToday.startTime} - ${state.scheduleToday.endTime}`
            : "null"}
        </div>
        <div data-slot="fichajeRealtimeBridge.stories-div">
          <strong>Pending Schedule Updates:</strong>{" "}
          <span data-slot="fichajeRealtimeBridge.stories-span" style={{ color: state.pendingScheduleUpdates ? "orange" : "gray" }}>
            {state.pendingScheduleUpdates ? "YES" : "NO"}
          </span>
        </div>

        {Object.keys(state.activeEntriesByMember).length > 0 && (
          <div data-slot="fichajeRealtimeBridge.stories-div" style={{ marginTop: "16px" }}>
            <strong>Active Entries:</strong>
            <ul data-slot="fichajeRealtimeBridge.stories-ul" style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
              {Object.values(state.activeEntriesByMember).map((entry) => (
                <li data-slot="fichajeRealtimeBridge.stories-li" key={entry.id}>
                  {entry.memberName} - Started at {entry.startTime}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper component that simulates WebSocket behavior
function BridgeWithSimulation({
  simulationMode,
  onStateChange,
}: {
  simulationMode: "disconnected" | "connecting" | "connected-empty" | "connected-active" | "with-schedule";
  onStateChange: (state: FichajeRealtimeState) => void;
}) {
  const [state, setState] = useAtom(mockFichajeRealtimeAtom);
  const session = useAtomValue(mockSessionAtom);

  useEffect(() => {
    onStateChange(state);
  }, [state, onStateChange]);

  // Simulate different connection states
  useEffect(() => {
    if (!session) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    switch (simulationMode) {
      case "disconnected":
        setState({
          wsConnected: false,
          wsConnecting: false,
          restaurantId: null,
          lastSyncAt: null,
          member: null,
          activeEntriesByMember: {},
          activeEntry: null,
          scheduleToday: null,
          pendingScheduleUpdates: false,
        });
        break;

      case "connecting":
        setState((prev) => ({ ...prev, wsConnecting: true, wsConnected: false }));
        // Stay in connecting state
        break;

      case "connected-empty":
        setState({
          wsConnected: true,
          wsConnecting: false,
          restaurantId: session.activeRestaurantId,
          lastSyncAt: Date.now(),
          member: { id: 1, fullName: "Test User", dni: null },
          activeEntriesByMember: {},
          activeEntry: null,
          scheduleToday: null,
          pendingScheduleUpdates: false,
        });
        break;

      case "connected-active":
        const activeEntry: FichajeActiveEntry = {
          id: 1,
          memberId: 1,
          memberName: "Test User",
          workDate: new Date().toISOString().split("T")[0],
          startTime: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
          startAtIso: new Date().toISOString(),
        };
        setState({
          wsConnected: true,
          wsConnecting: false,
          restaurantId: session.activeRestaurantId,
          lastSyncAt: Date.now(),
          member: { id: 1, fullName: "Test User", dni: null },
          activeEntriesByMember: { 1: activeEntry },
          activeEntry: activeEntry,
          scheduleToday: null,
          pendingScheduleUpdates: false,
        });
        break;

      case "with-schedule":
        const schedule: FichajeSchedule = {
          id: 1,
          memberId: 1,
          memberName: "Test User",
          date: new Date().toISOString().split("T")[0],
          startTime: "09:00",
          endTime: "17:00",
          breakMinutes: 60,
          updatedAt: new Date().toISOString(),
        };
        setState({
          wsConnected: true,
          wsConnecting: false,
          restaurantId: session.activeRestaurantId,
          lastSyncAt: Date.now(),
          member: { id: 1, fullName: "Test User", dni: null },
          activeEntriesByMember: {},
          activeEntry: null,
          scheduleToday: schedule,
          pendingScheduleUpdates: false,
        });
        break;
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [simulationMode, session, setState]);

  return <FichajeRealtimeBridge />;
}

const meta = {
  title: "ui/fichaje/FichajeRealtimeBridge",
  component: FichajeRealtimeBridge,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    controls: { expanded: true },
  },
  decorators: [
    (Story) => (
      <div data-slot="fichajeRealtimeBridge.stories-div" style={{ background: "#1a1a2e", padding: "20px", borderRadius: "8px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FichajeRealtimeBridge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DisconnectedState: Story = {
  name: "Disconnected State",
  render: () => {
    const [displayState, setDisplayState] = useState<FichajeRealtimeState | null>(null);

    return (
      <div data-slot="fichajeRealtimeBridge.stories-div" style={{ display: "flex", gap: "20px" }}>
        <BridgeWithSimulation simulationMode="disconnected" onStateChange={setDisplayState} />
        {displayState && <RealtimeStateDisplay />}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the state when WebSocket is disconnected and no session is active.",
      },
    },
  },
};

export const ConnectingState: Story = {
  name: "Connecting State",
  render: () => {
    const [displayState, setDisplayState] = useState<FichajeRealtimeState | null>(null);

    return (
      <div data-slot="fichajeRealtimeBridge.stories-div" style={{ display: "flex", gap: "20px" }}>
        <BridgeWithSimulation simulationMode="connecting" onStateChange={setDisplayState} />
        {displayState && <RealtimeStateDisplay />}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the state while WebSocket is attempting to connect.",
      },
    },
  },
};

export const ConnectedEmptyState: Story = {
  name: "Connected - Empty State",
  render: () => {
    const [displayState, setDisplayState] = useState<FichajeRealtimeState | null>(null);

    return (
      <div data-slot="fichajeRealtimeBridge.stories-div" style={{ display: "flex", gap: "20px" }}>
        <BridgeWithSimulation simulationMode="connected-empty" onStateChange={setDisplayState} />
        {displayState && <RealtimeStateDisplay />}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the state when WebSocket is connected but no active fichaje entries exist.",
      },
    },
  },
};

export const ConnectedWithActiveEntry: Story = {
  name: "Connected - With Active Entry",
  render: () => {
    const [displayState, setDisplayState] = useState<FichajeRealtimeState | null>(null);

    return (
      <div data-slot="fichajeRealtimeBridge.stories-div" style={{ display: "flex", gap: "20px" }}>
        <BridgeWithSimulation simulationMode="connected-active" onStateChange={setDisplayState} />
        {displayState && <RealtimeStateDisplay />}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the state when WebSocket is connected and the user has an active clock-in entry.",
      },
    },
  },
};

export const ConnectedWithSchedule: Story = {
  name: "Connected - With Schedule",
  render: () => {
    const [displayState, setDisplayState] = useState<FichajeRealtimeState | null>(null);

    return (
      <div data-slot="fichajeRealtimeBridge.stories-div" style={{ display: "flex", gap: "20px" }}>
        <BridgeWithSimulation simulationMode="with-schedule" onStateChange={setDisplayState} />
        {displayState && <RealtimeStateDisplay />}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the state when WebSocket is connected and the user has a schedule for today.",
      },
    },
  },
};

export const MultipleActiveEntries: Story = {
  name: "Connected - Multiple Active Entries",
  render: () => {
    const [displayState, setDisplayState] = useState<FichajeRealtimeState | null>(null);
    const [, setState] = useAtom(mockFichajeRealtimeAtom);

    useEffect(() => {
      const entries: Record<number, FichajeActiveEntry> = {
        1: {
          id: 1,
          memberId: 1,
          memberName: "John Doe",
          workDate: new Date().toISOString().split("T")[0],
          startTime: "09:00",
          startAtIso: new Date().toISOString(),
        },
        2: {
          id: 2,
          memberId: 2,
          memberName: "Jane Smith",
          workDate: new Date().toISOString().split("T")[0],
          startTime: "09:30",
          startAtIso: new Date().toISOString(),
        },
        3: {
          id: 3,
          memberId: 3,
          memberName: "Bob Wilson",
          workDate: new Date().toISOString().split("T")[0],
          startTime: "10:00",
          startAtIso: new Date().toISOString(),
        },
      };

      setState({
        wsConnected: true,
        wsConnecting: false,
        restaurantId: 1,
        lastSyncAt: Date.now(),
        member: { id: 1, fullName: "John Doe", dni: null },
        activeEntriesByMember: entries,
        activeEntry: entries[1],
        scheduleToday: null,
        pendingScheduleUpdates: false,
      });
    }, [setState]);

    return (
      <div data-slot="fichajeRealtimeBridge.stories-div" style={{ display: "flex", gap: "20px" }}>
        <FichajeRealtimeBridge />
        {displayState && <RealtimeStateDisplay />}
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the state when multiple team members have active clock-in entries.",
      },
    },
  },
};
