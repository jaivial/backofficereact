import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MobileModal } from "./MobileModal";
import { MobileActionButton } from "../MobileActionButton/MobileActionButton";

const meta = {
  title: "ui/mobile/MobileModal",
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
    const [open, setOpen] = useState(false);
    return (
      <>
        <MobileActionButton onClick={() => setOpen(true)}>Open Modal</MobileActionButton>
        <MobileModal open={open} onClose={() => setOpen(false)} title="Modal Title">
          <p>Modal content goes here.</p>
        </MobileModal>
      </>
    );
  },
};
