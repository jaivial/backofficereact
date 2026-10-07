import type { Meta, StoryObj } from "@storybook/react";
import { MenuTypePanelGrid } from "./MenuTypePanelGrid";
// Coordination id: menu_type_codes_v1 - counters are keyed by numeric menu_type code.
import { MENU_TYPE } from "./menuTypeCodes";
import type { MenuTypeCode } from "./menuTypeCodes";

const meta = {
  title: "ui/widgets/menus/MenuTypePanelGrid",
  component: MenuTypePanelGrid,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MenuTypePanelGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockOnSelect = (type: MenuTypeCode) => console.log("Selected menu type:", type);

export const Default: Story = {
  name: "Default",
  args: {
    countsByType: {
      [MENU_TYPE.CLOSED_CONVENTIONAL]: 5,
      [MENU_TYPE.CLOSED_GROUP]: 3,
      [MENU_TYPE.A_LA_CARTE]: 12,
      [MENU_TYPE.A_LA_CARTE_GROUP]: 2,
      [MENU_TYPE.SPECIAL]: 1,
    },
    onSelect: mockOnSelect,
  },
};

export const Empty: Story = {
  name: "Empty (no menus)",
  args: {
    countsByType: {
      [MENU_TYPE.CLOSED_CONVENTIONAL]: 0,
      [MENU_TYPE.CLOSED_GROUP]: 0,
      [MENU_TYPE.A_LA_CARTE]: 0,
      [MENU_TYPE.A_LA_CARTE_GROUP]: 0,
      [MENU_TYPE.SPECIAL]: 0,
    },
    onSelect: mockOnSelect,
  },
};

export const MixedCounts: Story = {
  name: "Mixed counts",
  args: {
    countsByType: {
      [MENU_TYPE.CLOSED_CONVENTIONAL]: 15,
      [MENU_TYPE.CLOSED_GROUP]: 8,
      [MENU_TYPE.A_LA_CARTE]: 0,
      [MENU_TYPE.A_LA_CARTE_GROUP]: 3,
      [MENU_TYPE.SPECIAL]: 1,
    },
    onSelect: mockOnSelect,
  },
};

export const WithCustomClassName: Story = {
  name: "With custom className",
  args: {
    countsByType: {
      [MENU_TYPE.CLOSED_CONVENTIONAL]: 2,
      [MENU_TYPE.CLOSED_GROUP]: 1,
      [MENU_TYPE.A_LA_CARTE]: 4,
      [MENU_TYPE.A_LA_CARTE_GROUP]: 0,
      [MENU_TYPE.SPECIAL]: 1,
    },
    onSelect: mockOnSelect,
    className: "max-w-2xl mx-auto",
  },
};

export const SingleMenuType: Story = {
  name: "Single menu type",
  args: {
    countsByType: {
      [MENU_TYPE.CLOSED_CONVENTIONAL]: 0,
      [MENU_TYPE.CLOSED_GROUP]: 0,
      [MENU_TYPE.A_LA_CARTE]: 1,
      [MENU_TYPE.A_LA_CARTE_GROUP]: 0,
      [MENU_TYPE.SPECIAL]: 0,
    },
    onSelect: mockOnSelect,
  },
};
