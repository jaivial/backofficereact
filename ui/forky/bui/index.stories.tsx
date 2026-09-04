import type { Meta, StoryObj } from "@storybook/react";
import { BuiIsland, InsightCards, LoadingState, PromptBar, StreamingText, ToolChips } from "./index";

/**
 * Literal beautifului.dev components, scoped inside <BuiIsland>.
 *
 * forky-bui-island.css defines the site's tokens + every utility the
 * components use under `.bui-scope`, so they render pixel-identical to
 * beautifului.dev without the backoffice global styles interfering.
 */
const meta = {
  title: "ui/forky/bui",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
  },
} satisfies Meta;

export default meta;

const Showcase = ({ children }: { children: React.ReactNode }) => (
  <div data-slot="index.stories-p-6" className="grid gap-10 rounded-xl bg-[#17171c] p-6">{children}</div>
);

export const PromptBarDemo: StoryObj = {
  render: () => (
    <Showcase>
      <BuiIsland>
        <PromptBar demo />
      </BuiIsland>
    </Showcase>
  ),
};

export const PromptBarInteractive: StoryObj = {
  render: () => (
    <Showcase>
      <BuiIsland>
        <PromptBar
          demo={false}
          placeholder="Write a message…"
          onSend={(text) => console.log("sent:", text)}
        />
      </BuiIsland>
    </Showcase>
  ),
};

export const InsightCardsDemo: StoryObj = {
  render: () => (
    <Showcase>
      <BuiIsland>
        <InsightCards />
      </BuiIsland>
    </Showcase>
  ),
};

export const ToolChipsDemo: StoryObj = {
  render: () => (
    <Showcase>
      <BuiIsland>
        <ToolChips />
      </BuiIsland>
    </Showcase>
  ),
};

export const StreamingTextDemo: StoryObj = {
  render: () => (
    <Showcase>
      <BuiIsland>
        <StreamingText />
      </BuiIsland>
    </Showcase>
  ),
};

export const LoadingStateDrive: StoryObj = {
  render: () => (
    <Showcase>
      <BuiIsland>
        <LoadingState label="Churning" variant="Drive" />
      </BuiIsland>
    </Showcase>
  ),
};

export const LoadingStateDots: StoryObj = {
  render: () => (
    <Showcase>
      <BuiIsland>
        <LoadingState label="Churning" variant="Dots" />
      </BuiIsland>
    </Showcase>
  ),
};

export const LoadingStateOrbit: StoryObj = {
  render: () => (
    <Showcase>
      <BuiIsland>
        <LoadingState label="Churning" variant="Orbit" />
      </BuiIsland>
    </Showcase>
  ),
};
