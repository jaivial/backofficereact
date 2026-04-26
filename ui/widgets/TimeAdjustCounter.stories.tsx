import type { Meta, StoryObj } from "@storybook/react";
import { TimeAdjustCounter } from "./TimeAdjustCounter";

const meta = {
  title: "ui/widgets/TimeAdjustCounter",
  component: TimeAdjustCounter,
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text" },
    value: { control: "text" },
    disabled: { control: "boolean" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof TimeAdjustCounter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    label: "Reserva tiempo",
    value: "00:00",
    onMinus: () => console.log("minus clicked"),
    onPlus: () => console.log("plus clicked"),
  },
};

export const WithValue: Story = {
  name: "With Value",
  args: {
    label: "Tiempo de espera",
    value: "00:30",
    onMinus: () => console.log("minus clicked"),
    onPlus: () => console.log("plus clicked"),
  },
};

export const Disabled: Story = {
  name: "Disabled",
  args: {
    label: "Reserva tiempo",
    value: "01:00",
    disabled: true,
    onMinus: () => console.log("minus clicked"),
    onPlus: () => console.log("plus clicked"),
  },
};

export const LongLabel: Story = {
  name: "Long Label",
  args: {
    label: "Tiempo adicional para reservas especiales",
    value: "00:45",
    onMinus: () => console.log("minus clicked"),
    onPlus: () => console.log("plus clicked"),
  },
};
