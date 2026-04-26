import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "../actions/Button";

const meta = {
  title: "ui/overlays/Modal",
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
        <Button onClick={() => setOpen(true)}>Open Modal</Button>
        <Modal open={open} title="Modal Title" onClose={() => setOpen(false)}>
          <div style={{ padding: "1rem" }}>
            <p>Modal content goes here.</p>
          </div>
        </Modal>
      </>
    );
  },
};

export const Small: Story = {
  name: "Small Size",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Small Modal</Button>
        <Modal open={open} title="Small Modal" onClose={() => setOpen(false)} size="sm">
          <div style={{ padding: "1rem" }}>
            <p>Small modal content.</p>
          </div>
        </Modal>
      </>
    );
  },
};
