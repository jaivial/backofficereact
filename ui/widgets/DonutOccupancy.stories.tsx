import type { Meta, StoryObj } from "@storybook/react";
import { DonutOccupancy } from "./DonutOccupancy";

const meta = {
  title: "ui/widgets/DonutOccupancy",
  component: DonutOccupancy,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof DonutOccupancy>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    totalPeople: 45,
    limit: 60,
    totalBookings: 12,
    pending: 3,
    confirmed: 9,
  },
};

export const FullOccupancy: Story = {
  name: "Full Occupancy",
  args: {
    totalPeople: 60,
    limit: 60,
  },
};

export const LowOccupancy: Story = {
  name: "Low Occupancy",
  args: {
    totalPeople: 15,
    limit: 60,
  },
};
