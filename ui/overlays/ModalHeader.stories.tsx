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

export const WithLongTitle: Story = {
  name: "With Long Title",
  args: {
    title: "This is a very long modal header title that might wrap to multiple lines depending on the container width",
    onClose: () => {},
  },
};

export const WithCustomCloseLabel: Story = {
  name: "With Custom Close Label",
  args: {
    title: "Custom Close Label",
    closeLabel: "Cancelar",
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

export const WithRichNodeTitle: Story = {
  name: "With Rich Node Title",
  args: {
    title: (
      <span data-slot="modalHeader.stories-span">
        <strong>Bold</strong> and <em>Italic</em> Title
      </span>
    ),
    closeLabel: "Cerrar",
    onClose: () => {},
  },
};
