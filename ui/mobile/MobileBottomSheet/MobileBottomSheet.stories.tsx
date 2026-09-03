import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MobileBottomSheet } from "./MobileBottomSheet";
import { MobileActionButton } from "../MobileActionButton/MobileActionButton";

const meta = {
  title: "ui/mobile/MobileBottomSheet",
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
        <MobileActionButton onClick={() => setOpen(true)}>Open Bottom Sheet</MobileActionButton>
        <MobileBottomSheet open={open} onClose={() => setOpen(false)} title="Bottom Sheet">
          <p data-slot="mobileBottomSheet.stories-p">Sheet content goes here.</p>
        </MobileBottomSheet>
      </>
    );
  },
};
