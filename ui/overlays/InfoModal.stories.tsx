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

export const OpenByDefault: Story = {
  name: "Open by Default",
  args: {
    open: true,
    title: "Reservation Confirmed",
    content: "Your reservation has been successfully confirmed. Please arrive 15 minutes before your scheduled time.",
  },
};

export const LongContent: Story = {
  name: "Long Content",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Show Info</Button>
        <InfoModal
          open={open}
          title="Terms and Conditions"
          content="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."
          onClose={() => setOpen(false)}
        />
      </>
    );
  },
};

export const Closed: Story = {
  name: "Closed (not visible)",
  args: {
    open: false,
    title: "Hidden Modal",
    content: "This modal will not be visible because open is set to false.",
  },
};
