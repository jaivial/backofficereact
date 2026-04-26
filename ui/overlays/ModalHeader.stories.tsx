import type { Meta, StoryObj } from "@storybook/react";
import { ModalHeader } from "./ModalHeader";

const meta = {
  title: "ui/overlays/ModalHeader",
  component: ModalHeader,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ModalHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    title: "Modal Title",
    onClose: () => {},
  },
};

export const WithNodeTitle: Story = {
  name: "With Node Title",
  args: {
    title: <strong>Bold Title</strong>,
    onClose: () => {},
  },
};
