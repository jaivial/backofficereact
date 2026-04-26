import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { Button } from "../actions/Button";

const meta = {
  title: "ui/overlays/ConfirmDialog",
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
        <Button onClick={() => setOpen(true)}>Open Confirm Dialog</Button>
        <ConfirmDialog
          open={open}
          title="Confirm Action"
          message="Are you sure you want to proceed?"
          onClose={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};

export const Danger: Story = {
  name: "Danger",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>Delete Item</Button>
        <ConfirmDialog
          open={open}
          title="Delete Item"
          message="This action cannot be undone. Are you sure?"
          confirmLabel="Delete"
          danger
          onClose={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};

export const Busy: Story = {
  name: "Busy",
  render: () => {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);

    const handleConfirm = async () => {
      setBusy(true);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setBusy(false);
      setOpen(false);
    };

    return (
      <>
        <Button onClick={() => setOpen(true)}>Process Action</Button>
        <ConfirmDialog
          open={open}
          title="Processing"
          message="Please wait while we process your request..."
          confirmLabel="Save"
          busy={busy}
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
        />
      </>
    );
  },
};

export const CustomLabels: Story = {
  name: "Custom Labels",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Accept Terms</Button>
        <ConfirmDialog
          open={open}
          title="Accept Terms"
          message="Please accept the terms and conditions to continue."
          confirmText="Accept"
          cancelText="Decline"
          onClose={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};

export const LongMessage: Story = {
  name: "Long Message",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Show Long Message</Button>
        <ConfirmDialog
          open={open}
          title="Important Notice"
          message="This is a longer message that contains more detailed information about the action you are about to take. Please read it carefully before proceeding. The system will process your request and this may take several minutes to complete. All changes will be saved and you will receive a notification when the process is finished."
          confirmLabel="I Understand"
          onClose={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
        />
      </>
    );
  },
};

export const ActionResult: Story = {
  name: "With Action Result",
  render: () => {
    const [open, setOpen] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    return (
      <>
        <Button onClick={() => setOpen(true)}>Trigger Action</Button>
        {result && (
          <p style={{ marginTop: "1rem", color: "#16a34a" }}>
            Result: {result}
          </p>
        )}
        <ConfirmDialog
          open={open}
          title="Confirm Action"
          message="Do you want to save your changes?"
          confirmLabel="Save"
          onConfirm={() => {
            setResult("Changes saved successfully!");
            setOpen(false);
          }}
          onCancel={() => {
            setResult(null);
            setOpen(false);
          }}
        />
      </>
    );
  },
};
