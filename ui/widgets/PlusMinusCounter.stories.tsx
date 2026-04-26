import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PlusMinusCounter } from "./PlusMinusCounter";

const meta = {
  title: "ui/widgets/PlusMinusCounter",
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
    const [value, setValue] = useState(1);
    return (
      <PlusMinusCounter
        label="Guests"
        value={value}
        onDecrease={() => setValue((v) => Math.max(1, v - 1))}
        onIncrease={() => setValue((v) => v + 1)}
      />
    );
  },
};

export const WithLimits: Story = {
  name: "With Limits",
  render: () => {
    const [value, setValue] = useState(5);
    return (
      <PlusMinusCounter
        label="Rooms"
        value={value}
        onDecrease={() => setValue((v) => Math.max(1, v - 1))}
        onIncrease={() => setValue((v) => Math.min(10, v + 1))}
        canDecrease={value > 1}
        canIncrease={value < 10}
        helperText="Select number of rooms (1-10)"
      />
    );
  },
};
