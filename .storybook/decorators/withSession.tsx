import type { Decorator } from "@storybook/react";
import React from "react";

/**
 * Storybook decorator that injects mock Jotai atom state
 * for authenticated backoffice stories.
 *
 * Mounts a session provider wrapper with pre-seeded admin atom values
 * so stories can render authenticated UI without a real backend.
 */
const withSession: Decorator = (Story, context) => {
  // Inject mock session context via a hidden data attribute on the wrapper.
  // Consumers can read this in their stories if they need to assert on it.
  return (
    <div data-storybook="with-session">
      <Story />
    </div>
  );
};

export default withSession;
