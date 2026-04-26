import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { InfoModal } from "./InfoModal";
import { Button } from "../actions/Button";

const meta = {
  title: "ui/overlays/InfoModal",
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
        <Button onClick={() => setOpen(true)}>Show Info</Button>
        <InfoModal
          open={open}
          title="Information"
          content="This is some important information you should know."
          onClose={() => setOpen(false)}
        />
      </>
    );
  },
};
