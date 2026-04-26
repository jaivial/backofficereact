import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ImageAdvisorOverlay } from "./ImageAdvisorOverlay";

const meta = {
  title: "ui/inputs/ImageAdvisorOverlay",
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
    const [open, setOpen] = useState(true);
    return (
      <ImageAdvisorOverlay
        open={open}
        previewUrl="https://images.unsplash.com/photo-1546069901-ba9599a7e63c"
        busy={false}
        onClose={() => setOpen(false)}
        onUploadPlain={() => {}}
        onEnhanceAI={() => {}}
      />
    );
  },
};

export const Busy: Story = {
  name: "Busy",
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <ImageAdvisorOverlay
        open={open}
        previewUrl="https://images.unsplash.com/photo-1546069901-ba9599a7e63c"
        busy={true}
        onClose={() => setOpen(false)}
        onUploadPlain={() => {}}
        onEnhanceAI={() => {}}
      />
    );
  },
};
