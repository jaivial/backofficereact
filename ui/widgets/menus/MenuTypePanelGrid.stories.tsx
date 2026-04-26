import type { Meta, StoryObj } from "@storybook/react";
import { MenuTypePanelGrid } from "./MenuTypePanelGrid";

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

const mockOnSelect = (type: string) => console.log("Selected menu type:", type);

export const Default: Story = {
  name: "Default",
  args: {
    countsByType: {
      closed_conventional: 5,
      closed_group: 3,
      a_la_carte: 12,
      a_la_carte_group: 2,
      special: 1,
    },
    onSelect: mockOnSelect,
  },
};

export const Empty: Story = {
  name: "Empty (no menus)",
  args: {
    countsByType: {
      closed_conventional: 0,
      closed_group: 0,
      a_la_carte: 0,
      a_la_carte_group: 0,
      special: 0,
    },
    onSelect: mockOnSelect,
  },
};

export const MixedCounts: Story = {
  name: "Mixed counts",
  args: {
    countsByType: {
      closed_conventional: 15,
      closed_group: 8,
      a_la_carte: 0,
      a_la_carte_group: 3,
      special: 1,
    },
    onSelect: mockOnSelect,
  },
};

export const WithCustomClassName: Story = {
  name: "With custom className",
  args: {
    countsByType: {
      closed_conventional: 2,
      closed_group: 1,
      a_la_carte: 4,
      a_la_carte_group: 0,
      special: 1,
    },
    onSelect: mockOnSelect,
    className: "max-w-2xl mx-auto",
  },
};

export const SingleMenuType: Story = {
  name: "Single menu type",
  args: {
    countsByType: {
      closed_conventional: 0,
      closed_group: 0,
      a_la_carte: 1,
      a_la_carte_group: 0,
      special: 0,
    },
    onSelect: mockOnSelect,
  },
};
