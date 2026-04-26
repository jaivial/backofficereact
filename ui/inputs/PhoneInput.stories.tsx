import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PhoneInput } from "./PhoneInput";

const meta = {
  title: "ui/inputs/PhoneInput",
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
    const [countryCode, setCountryCode] = useState("34");
    const [number, setNumber] = useState("612345678");
    return (
      <PhoneInput
        countryCode={countryCode}
        number={number}
        onCountryCodeChange={setCountryCode}
        onNumberChange={setNumber}
      />
    );
  },
};
