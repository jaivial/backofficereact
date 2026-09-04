import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "../actions/Button";

const meta = {
  title: "ui/overlays/Modal",
  component: Modal,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Modal>;

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
          <div data-slot="modal.stories-div" style={{ padding: "1rem" }}>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>Modal content goes here.</p>
            <div data-slot="modal.stories-div" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>Confirm</Button>
            </div>
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
          <div data-slot="modal.stories-div" style={{ padding: "1rem" }}>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>Small modal content (460px).</p>
            <div data-slot="modal.stories-div" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>Confirm</Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};

export const Medium: Story = {
  name: "Medium Size",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Medium Modal</Button>
        <Modal open={open} title="Medium Modal" onClose={() => setOpen(false)} size="md">
          <div data-slot="modal.stories-div" style={{ padding: "1rem" }}>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>Medium modal content (640px).</p>
            <div data-slot="modal.stories-div" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>Confirm</Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};

export const Large: Story = {
  name: "Large Size",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Large Modal</Button>
        <Modal open={open} title="Large Modal" onClose={() => setOpen(false)} size="lg">
          <div data-slot="modal.stories-div" style={{ padding: "1rem" }}>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>Large modal content (840px).</p>
            <div data-slot="modal.stories-div" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>Confirm</Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};

export const WithForm: Story = {
  name: "With Form Content",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Form Modal</Button>
        <Modal open={open} title="Create New Item" onClose={() => setOpen(false)} size="md">
          <div data-slot="modal.stories-div" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div data-slot="modal.stories-div">
              <label data-slot="modal.stories-label" style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}>
                Name
              </label>
              <input data-testid="enter-name"
                type="text"
                placeholder="Enter name"
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div data-slot="modal.stories-div">
              <label data-slot="modal.stories-label" style={{ display: "block", marginBottom: "4px", fontSize: "14px", fontWeight: 500 }}>
                Description
              </label>
              <textarea data-testid="enter-description"
                placeholder="Enter description"
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>
            <div data-slot="modal.stories-div" style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>Create</Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};

export const Confirmation: Story = {
  name: "Confirmation Dialog",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button variant="danger" onClick={() => setOpen(true)}>Delete Item</Button>
        <Modal open={open} title="Confirm Deletion" onClose={() => setOpen(false)} size="sm">
          <div data-slot="modal.stories-div" style={{ padding: "1rem" }}>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem", color: "#374151" }}>
              Are you sure you want to delete this item? This action cannot be undone.
            </p>
            <div data-slot="modal.stories-div" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => setOpen(false)}>Delete</Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};

export const LongContent: Story = {
  name: "With Long Content",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Terms Modal</Button>
        <Modal open={open} title="Terms and Conditions" onClose={() => setOpen(false)} size="lg">
          <div data-slot="modal.stories-div" style={{ padding: "1rem", maxHeight: "400px", overflowY: "auto" }}>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            </p>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>
              Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            </p>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>
              Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
            </p>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.
            </p>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>
              Totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
            </p>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>
              Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.
            </p>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>
              Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.
            </p>
            <div data-slot="modal.stories-div" style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "1rem" }}>
              <Button onClick={() => setOpen(false)}>Close</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>Accept</Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};

export const CustomWidth: Story = {
  name: "Custom Width (500px)",
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open Custom Width Modal</Button>
        <Modal open={open} title="Custom Width Modal" onClose={() => setOpen(false)} widthPx={500}>
          <div data-slot="modal.stories-div" style={{ padding: "1rem" }}>
            <p data-slot="modal.stories-p" style={{ margin: "0 0 1rem" }}>
              This modal has a custom width of 500px set via the <code>widthPx</code> prop.
            </p>
            <div data-slot="modal.stories-div" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        </Modal>
      </>
    );
  },
};
