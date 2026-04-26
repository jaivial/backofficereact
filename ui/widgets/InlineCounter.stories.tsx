import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { InlineCounter } from "./InlineCounter";

const meta = {
  title: "ui/widgets/InlineCounter",
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
    const [value, setValue] = useState(5);
    return <InlineCounter label="Quantity" value={value} onChange={setValue} />;
  },
};

export const WithMinMax: Story = {
  name: "With Min/Max",
  render: () => {
    const [value, setValue] = useState(50);
    return <InlineCounter label="Percentage" value={value} onChange={setValue} min={0} max={100} />;
  },
};
