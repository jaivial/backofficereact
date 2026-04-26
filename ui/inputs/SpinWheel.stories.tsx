import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { SpinWheel } from "./SpinWheel";

const values = ["00", "15", "30", "45", "60"];

const meta = {
  title: "ui/inputs/SpinWheel",
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
    const [value, setValue] = useState("30");
    return <SpinWheel values={values} value={value} onChange={setValue} ariaLabel="Minutes" />;
  },
};

export const Small: Story = {
  name: "Small",
  render: () => {
    const [value, setValue] = useState("15");
    return <SpinWheel values={values} value={value} onChange={setValue} ariaLabel="Minutes" size="sm" />;
  },
};
