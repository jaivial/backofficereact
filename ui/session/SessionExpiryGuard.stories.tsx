import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { StoryContext } from "@storybook/react";
import { Provider } from "jotai";

import { SessionExpiryGuard } from "./SessionExpiryGuard";

const SESSION_EXPIRATION_UPDATED_EVENT = "session-expiration-updated";
const SESSION_EXPIRED_EVENT = "session-expired";

const dispatchEvents = (
  _ctx: StoryContext,
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

const decorators = [
  (Story: React.ComponentType) => (
    <Provider>
      <div data-slot="sessionExpiryGuard.stories-div" style={{ padding: "1rem", background: "#f5f5f5", minHeight: "100vh" }}>
        <Story />
      </div>
    </Provider>
  ),
];

export default {
  title: "UI/Session/SessionExpiryGuard",
  component: SessionExpiryGuard,
  parameters: {
    layout: "fullscreen",
  },
  decorators,
} as Meta<typeof SessionExpiryGuard>;

type Story = StoryObj<typeof SessionExpiryGuard>;

export const ActiveSession: Story = {
  render: function Render() {
    return <SessionExpiryGuard />;
  },
  loaders: [
    async (_ctx: StoryContext) => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      dispatchEvents(_ctx, futureDate, null);
      return {};
    },
  ],
};

export const SessionExpiringSoon: Story = {
  render: function Render() {
    return <SessionExpiryGuard />;
  },
  loaders: [
    async (_ctx: StoryContext) => {
      const nearFutureDate = new Date(Date.now() + 2000).toISOString();
      dispatchEvents(_ctx, nearFutureDate, null);
      return {};
    },
  ],
};

export const SessionExpired: Story = {
  render: function Render() {
    return <SessionExpiryGuard />;
  },
  loaders: [
    async (_ctx: StoryContext) => {
      dispatchEvents(_ctx, null, 100);
      return {};
    },
  ],
};

export const OnLoginPage: Story = {
  render: function Render() {
    return <SessionExpiryGuard />;
  },
  loaders: [
    async (_ctx: StoryContext) => {
      dispatchEvents(_ctx, null, 100);
      return {};
    },
  ],
};
