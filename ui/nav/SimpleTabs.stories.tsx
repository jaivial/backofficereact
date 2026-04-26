import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SimpleTabs, SimpleTabsContent } from "./SimpleTabs";
import type { SimpleTabItem } from "./SimpleTabs";

const items: SimpleTabItem[] = [
  { id: "tab1", label: "Tab 1" },
  { id: "tab2", label: "Tab 2" },
  { id: "tab3", label: "Tab 3" },
];

const meta = {
  title: "ui/nav/SimpleTabs",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  render: () => {
    const [activeId, setActiveId] = useState("tab1");
    return (
      <SimpleTabs
        items={items}
        activeId={activeId}
        onChange={setActiveId}
        ariaLabel="Simple tabs"
      >
        <SimpleTabsContent id="tab1" value="tab1">Content for Tab 1</SimpleTabsContent>
        <SimpleTabsContent id="tab2" value="tab2">Content for Tab 2</SimpleTabsContent>
        <SimpleTabsContent id="tab3" value="tab3">Content for Tab 3</SimpleTabsContent>
      </SimpleTabs>
    );
  },
};
