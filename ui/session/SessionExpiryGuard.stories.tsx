import React, { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { StoryContext, StoryObj } from "@storybook/react";
import { Provider } from "jotai";

import { SessionExpiryGuard } from "./SessionExpiryGuard";
import { sessionAtom, sessionMovingExpirationAtom } from "../../state/atoms";

const SESSION_EXPIRATION_UPDATED_EVENT = "session-expiration-updated";
const SESSION_EXPIRED_EVENT = "session-expired";

const dispatchEvents = (
  ctx: StoryContext,
  expirationDate: string | null,
  triggerExpireAfterMs: number | null,
) => {
  if (expirationDate) {
    window.dispatchEvent(
      new CustomEvent(SESSION_EXPIRATION_UPDATED_EVENT, {
        detail: expirationDate,
      }),
    );
  }

  if (triggerExpireAfterMs !== null) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }, triggerExpireAfterMs);
  }
};

const mockFetch = jest.fn().mockResolvedValue(undefined);
jest.mock("../../lib/session-expiration", () => ({
  SESSION_EXPIRED_EVENT: "session-expired",
  SESSION_EXPIRATION_UPDATED_EVENT: "session-expiration-updated",
  normalizeExpirationDate: (date: string | null) => date,
}));

jest.mock("../../state/atoms", () => {
  const actual = jest.requireActual("../../state/atoms");
  return {
    ...actual,
  };
});

const originalLocation = { ...window.location };

function withLoginRedirectMock(Story: React.ComponentType, context: StoryContext) {
  // Mock window.location
  const mockLocation = {
    ...originalLocation,
    pathname: context.globals?.pathname || "/dashboard",
    search: context.globals?.search || "",
  };
  Object.defineProperty(window, "location", {
    value: mockLocation,
    writable: true,
    configurable: true,
  });

  // Mock fetch
  const originalFetch = global.fetch;
  global.fetch = mockFetch as typeof fetch;

  // Reset mock before each story
  mockFetch.mockClear();
  mockFetch.mockResolvedValue(undefined);

  return (
    <Story />
  );
}

const parameters = {
  layout: "fullscreen",
  parameters: {
    mockData: [],
  },
  globalTypes: {
    pathname: {
      name: "Pathname",
      description: "The current pathname",
      defaultValue: "/dashboard",
      toolbar: {
        icon: "globe",
        items: [
          { value: "/dashboard", title: "Dashboard" },
          { value: "/login", title: "Login Page" },
        ],
      },
    },
    search: {
      name: "Search",
      description: "The current search string",
      defaultValue: "",
      toolbar: {
        icon: "search",
        items: [
          { value: "", title: "None" },
          { value: "?tab=settings", title: "With Query" },
        ],
      },
    },
  },
};

const decorators = [
  (Story: React.ComponentType, context: StoryContext) => (
    <Provider>
      <div style={{ padding: "1rem", background: "#f5f5f5", minHeight: "100vh" }}>
        <Story />
      </div>
    </Provider>
  ),
];

export default {
  title: "UI/Session/SessionExpiryGuard",
  component: SessionExpiryGuard,
  parameters,
  decorators,
  loaders: [
    async (context: StoryContext) => {
      // Clear any existing listeners
      return {};
    },
  ],
} as Meta<typeof SessionExpiryGuard>;

type Story = StoryObj<typeof SessionExpiryGuard>;

export const ActiveSession: Story = {
  globals: {
    pathname: "/dashboard",
  },
  render: function Render() {
    return <SessionExpiryGuard />;
  },
  loaders: [
    async (context: StoryContext) => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
     dispatchEvents(context, futureDate, null);
      return {};
    },
  ],
};

export const SessionExpiringSoon: Story = {
  globals: {
    pathname: "/dashboard",
  },
  render: function Render() {
    return <SessionExpiryGuard />;
  },
  loaders: [
    async (context: StoryContext) => {
      // Set expiration in 2 seconds
      const nearFutureDate = new Date(Date.now() + 2000).toISOString();
     dispatchEvents(context, nearFutureDate, null);
      return {};
    },
  ],
};

export const SessionExpired: Story = {
  globals: {
    pathname: "/dashboard",
  },
  render: function Render() {
    return <SessionExpiryGuard />;
  },
  loaders: [
    async (context: StoryContext) => {
      // Trigger immediate expiration
     dispatchEvents(context, null, 100);
      return {};
    },
  ],
};

export const OnLoginPage: Story = {
  globals: {
    pathname: "/login",
  },
  render: function Render() {
    return <SessionExpiryGuard />;
  },
  loaders: [
    async (context: StoryContext) => {
      // Even with expiration, should not redirect on login page
     dispatchEvents(context, null, 100);
      return {};
    },
  ],
};
