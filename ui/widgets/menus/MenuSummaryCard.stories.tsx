import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";

import { MenuSummaryCard } from "./MenuSummaryCard";
import type { GroupMenuV2Summary } from "../../../api/types";

const createMenu = (overrides: Partial<GroupMenuV2Summary> = {}): GroupMenuV2Summary => ({
  id: 1,
  menu_title: "Menu Degustacion",
  price: "45.00",
  active: true,
  is_draft: false,
  menu_type: "closed_conventional",
  created_at: "2024-01-15T10:00:00Z",
  modified_at: "2024-01-20T14:30:00Z",
  ...overrides,
});

const meta = {
  title: "ui/widgets/menus/MenuSummaryCard",
  component: MenuSummaryCard,
  tags: ["autodocs"],
  argTypes: {
    menu: { control: "object" },
    switchDisabled: { control: "boolean" },
    actionsDisabled: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
  args: {
    onToggleActive: fn(),
    onOpenEditor: fn(),
    onRequestChangeType: fn(),
    onRequestDelete: fn(),
  },
} satisfies Meta<typeof MenuSummaryCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    menu: createMenu(),
    switchDisabled: false,
    actionsDisabled: false,
  },
};

export const ActiveMenu: Story = {
  name: "Active Menu",
  args: {
    menu: createMenu({
      id: 1,
      menu_title: "Menu del Dia",
      active: true,
      is_draft: false,
    }),
    switchDisabled: false,
    actionsDisabled: false,
  },
};

export const InactiveMenu: Story = {
  name: "Inactive Menu",
  args: {
    menu: createMenu({
      id: 2,
      menu_title: "Menu Tapa",
      active: false,
      is_draft: false,
    }),
    switchDisabled: false,
    actionsDisabled: false,
  },
};

export const DraftMenu: Story = {
  name: "Draft Menu",
  args: {
    menu: createMenu({
      id: 3,
      menu_title: "Menu Nuevo (Borrador)",
      active: false,
      is_draft: true,
    }),
    switchDisabled: false,
    actionsDisabled: false,
  },
};

export const WithLongTitle: Story = {
  name: "With Long Title",
  args: {
    menu: createMenu({
      id: 4,
      menu_title: "Menu Especial de Temporada de Primavera con Ingredientes Regionales",
      active: true,
      is_draft: false,
    }),
    switchDisabled: false,
    actionsDisabled: false,
  },
};

export const WithoutTitle: Story = {
  name: "Without Title",
  args: {
    menu: createMenu({
      id: 5,
      menu_title: "",
      active: true,
      is_draft: false,
    }),
    switchDisabled: false,
    actionsDisabled: false,
  },
};

export const SwitchDisabled: Story = {
  name: "Switch Disabled",
  args: {
    menu: createMenu({
      id: 6,
      active: true,
    }),
    switchDisabled: true,
    actionsDisabled: false,
  },
};

export const ActionsDisabled: Story = {
  name: "Actions Disabled",
  args: {
    menu: createMenu({
      id: 7,
      active: true,
    }),
    switchDisabled: false,
    actionsDisabled: true,
  },
};

export const AllDisabled: Story = {
  name: "All Controls Disabled",
  args: {
    menu: createMenu({
      id: 8,
      active: false,
      is_draft: true,
    }),
    switchDisabled: true,
    actionsDisabled: true,
  },
};

export const ALaCarteMenu: Story = {
  name: "A La Carte Menu",
  args: {
    menu: createMenu({
      id: 9,
      menu_title: "Carta Tradicional",
      menu_type: "a_la_carte",
      active: true,
      is_draft: false,
    }),
    switchDisabled: false,
    actionsDisabled: false,
  },
};

export const GroupMenu: Story = {
  name: "Group Menu",
  args: {
    menu: createMenu({
      id: 10,
      menu_title: "Menu Grupo Cerrado",
      menu_type: "closed_group",
      active: true,
      is_draft: false,
    }),
    switchDisabled: false,
    actionsDisabled: false,
  },
};

export const SpecialMenu: Story = {
  name: "Special Menu",
  args: {
    menu: createMenu({
      id: 11,
      menu_title: "Menu Especial Navideno",
      menu_type: "special",
      active: true,
      is_draft: false,
      price: "65.00",
    }),
    switchDisabled: false,
    actionsDisabled: false,
  },
};
