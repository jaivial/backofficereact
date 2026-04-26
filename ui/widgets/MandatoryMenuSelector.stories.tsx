import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MandatoryMenuSelector } from "./MandatoryMenuSelector";
import type { MenuSelectorItem } from "../../api/types";

const mockMenus: MenuSelectorItem[] = [
  { id: 1, menu_title: "Menu Degustacion Premium", menu_type: "closed_conventional" },
  { id: 2, menu_title: "Menu del Dia", menu_type: "a_la_carte" },
  { id: 3, menu_title: "Menu Grupo Temporada", menu_type: "closed_group" },
  { id: 4, menu_title: "Menu Especial Navideno", menu_type: "special" },
  { id: 5, menu_title: "Menu Grupo A la Carte", menu_type: "a_la_carte_group" },
];

const meta = {
  title: "ui/widgets/MandatoryMenuSelector",
  component: MandatoryMenuSelector,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MandatoryMenuSelector>;

function MenuSelectorWithState(props: React.ComponentProps<typeof MandatoryMenuSelector>) {
  const [selectedIds, setSelectedIds] = useState(props.selectedMenuIds);
  const [chooseMain, setChooseMain] = useState(props.menuChooseMain);
  return (
    <MandatoryMenuSelector
      {...props}
      selectedMenuIds={selectedIds}
      menuChooseMain={chooseMain}
      onChange={(menuIds, mainIds) => {
        setSelectedIds(menuIds);
        setChooseMain(mainIds);
      }}
    />
  );
}

export default meta;
type Story = StoryObj<typeof meta>;

// Empty state
export const EmptyState: Story = {
  name: "Empty State",
  render: () => (
    <MenuSelectorWithState
      menus={mockMenus}
      selectedMenuIds={[]}
      menuChooseMain={[]}
    />
  ),
};

// Single menu selected
export const SingleMenuSelected: Story = {
  name: "Single Menu Selected",
  render: () => (
    <MenuSelectorWithState
      menus={mockMenus}
      selectedMenuIds={[1]}
      menuChooseMain={[]}
    />
  ),
};

// Single menu marked as main
export const SingleMenuAsMain: Story = {
  name: "Single Menu as Main",
  render: () => (
    <MenuSelectorWithState
      menus={mockMenus}
      selectedMenuIds={[1]}
      menuChooseMain={[1]}
    />
  ),
};

// Multiple menus selected
export const MultipleMenusSelected: Story = {
  name: "Multiple Menus Selected",
  render: () => (
    <MenuSelectorWithState
      menus={mockMenus}
      selectedMenuIds={[1, 3, 4]}
      menuChooseMain={[]}
    />
  ),
};

// Multiple menus with one as main
export const MultipleMenusWithOneMain: Story = {
  name: "Multiple Menus with One Main",
  render: () => (
    <MenuSelectorWithState
      menus={mockMenus}
      selectedMenuIds={[1, 3, 4]}
      menuChooseMain={[3]}
    />
  ),
};

// Multiple menus with multiple mains
export const MultipleMenusWithMultipleMains: Story = {
  name: "Multiple Menus with Multiple Mains",
  render: () => (
    <MenuSelectorWithState
      menus={mockMenus}
      selectedMenuIds={[1, 3, 4, 5]}
      menuChooseMain={[3, 5]}
    />
  ),
};

// All menus selected
export const AllMenusSelected: Story = {
  name: "All Menus Selected",
  render: () => (
    <MenuSelectorWithState
      menus={mockMenus}
      selectedMenuIds={[1, 2, 3, 4, 5]}
      menuChooseMain={[1, 2]}
    />
  ),
};

// No menus available
export const NoMenusAvailable: Story = {
  name: "No Menus Available",
  render: () => (
    <MenuSelectorWithState
      menus={[]}
      selectedMenuIds={[]}
      menuChooseMain={[]}
    />
  ),
};

// With custom className
export const WithCustomClassName: Story = {
  name: "With Custom ClassName",
  render: () => (
    <MenuSelectorWithState
      menus={mockMenus}
      selectedMenuIds={[2]}
      menuChooseMain={[]}
      className="max-w-md border border-dashed border-gray-400 p-4 rounded-lg"
    />
  ),
};
