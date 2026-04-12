import type { Meta, StoryObj } from "@storybook/react";
import { LoadingSpinner } from "./LoadingSpinner";

const meta = {
  title: "ui/feedback/LoadingSpinner",
  component: LoadingSpinner,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["sm", "md", "lg", "xl"],
    },
    tone: {
      control: "select",
      options: ["default", "lila", "cyan", "white", "dark"],
    },
    centered: { control: "boolean" },
    label: { control: "text" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof LoadingSpinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    label: "Cargando...",
    size: "md",
    centered: false,
  },
};

export const Small: Story = {
  name: "Small",
  args: {
    size: "sm",
    centered: false,
  },
};

export const Medium: Story = {
  name: "Medium",
  args: {
    size: "md",
    centered: false,
  },
};

export const Large: Story = {
  name: "Large",
  args: {
    size: "lg",
    centered: false,
  },
};

export const Centered: Story = {
  name: "Centered",
  args: {
    size: "md",
    centered: true,
    label: "Cargando...",
  },
};
