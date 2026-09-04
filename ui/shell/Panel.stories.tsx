import type { Meta, StoryObj } from "@storybook/react";
import { Panel } from "./Panel";

const meta = {
  title: "ui/shell/Panel",
  component: Panel,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "glass"],
    },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    title: "Panel Title",
    children: <p>Panel content</p>,
  },
};

export const Glass: Story = {
  name: "Glass",
  args: {
    variant: "glass",
    title: "Glass Panel",
    children: <p>Panel content</p>,
  },
};

export const WithMeta: Story = {
  name: "With Meta",
  args: {
    title: "Panel with Meta",
    meta: "Additional information",
    children: <p>Panel content</p>,
  },
};

export const WithActions: Story = {
  name: "With Actions",
  args: {
    title: "Panel with Actions",
    actions: (
      <div data-slot="panel.stories-div" style={{ display: "flex", gap: "8px" }}>
        <button data-testid="edit" onClick={() => {}}>Edit</button>
        <button data-testid="delete" onClick={() => {}}>Delete</button>
      </div>
    ),
    children: <p>This panel has action buttons in the header.</p>,
  },
};

export const WithFullHeader: Story = {
  name: "With Full Header",
  args: {
    title: "Complete Panel",
    meta: "Version 1.0",
    actions: (
      <div data-slot="panel.stories-div" style={{ display: "flex", gap: "8px" }}>
        <button data-testid="settings" onClick={() => {}}>Settings</button>
      </div>
    ),
    children: (
      <div data-slot="panel.stories-div">
        <p data-slot="panel.stories-p">This panel has all header elements: title, meta, and actions.</p>
        <p data-slot="panel.stories-p">Additional content can go here.</p>
      </div>
    ),
  },
};

export const GlassWithFullHeader: Story = {
  name: "Glass With Full Header",
  args: {
    variant: "glass",
    title: "Glass Panel",
    meta: "Premium feature",
    actions: (
      <button data-testid="upgrade" onClick={() => {}}>Upgrade</button>
    ),
    children: <p>Glass panels work great with all header elements.</p>,
  },
};

export const Empty: Story = {
  name: "Empty (No Header)",
  args: {
    children: <p>A panel without a header - just body content.</p>,
  },
};

export const RichContent: Story = {
  name: "Rich Content",
  args: {
    title: "Rich Content Panel",
    meta: "Documentation",
    children: (
      <div data-slot="panel.stories-div">
        <h3 data-slot="panel.stories-h3">Features</h3>
        <ul data-slot="panel.stories-ul">
          <li data-slot="panel.stories-li">Feature one</li>
          <li data-slot="panel.stories-li">Feature two</li>
          <li data-slot="panel.stories-li">Feature three</li>
        </ul>
        <p data-slot="panel.stories-p">This panel demonstrates rich HTML content in the body.</p>
      </div>
    ),
  },
};
