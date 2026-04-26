import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabItem } from "./Tabs";

const tabs: TabItem[] = [
  { id: "tab1", label: "Tab 1", href: "/tab1", icon: <span>1</span> },
  { id: "tab2", label: "Tab 2", href: "/tab2", icon: <span>2</span> },
  { id: "tab3", label: "Tab 3", href: "/tab3", icon: <span>3</span> },
];

const meta = {
  title: "ui/nav/Tabs",
  component: Tabs,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    tabs,
    activeId: "tab1",
    ariaLabel: "Main navigation tabs",
  },
};

export const ActiveSecondTab: Story = {
  name: "Active Second Tab",
  args: {
    tabs,
    activeId: "tab2",
    ariaLabel: "Main navigation tabs",
  },
};
