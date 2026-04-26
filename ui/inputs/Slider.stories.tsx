import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Slider } from "./Slider";

const meta = {
  title: "ui/inputs/Slider",
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
    const [value, setValue] = useState(50);
    return <Slider value={value} onChange={setValue} ariaLabel="Volume" />;
  },
};

export const WithRange: Story = {
  name: "With Range",
  render: () => {
    const [value, setValue] = useState(75);
    return <Slider value={value} onChange={setValue} min={0} max={100} ariaLabel="Percentage" />;
  },
};
