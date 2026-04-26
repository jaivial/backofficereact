import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { TimeAdjust } from "./TimeAdjust";

const meta = {
  component: TimeAdjust,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    disabled: { control: "boolean" },
  },
  args: {
    onMinus: fn(),
    onPlus: fn(),
  },
} satisfies Meta<typeof TimeAdjust>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Tiempo de Cocción",
    value: "01:30:00",
  },
};

export const Disabled: Story = {
  args: {
    label: "Tiempo de Cocción",
    value: "01:30:00",
    disabled: true,
  },
};

export const ZeroTime: Story = {
  args: {
    label: "Tiempo de Espera",
    value: "00:00:00",
  },
};

export const LongLabel: Story = {
  args: {
    label: "Tiempo de Preparación del Plato Principal",
    value: "02:45:00",
  },
};
