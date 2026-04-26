import type { Meta, StoryObj } from "@storybook/react";
import { ImageDropInput } from "./ImageDropInput";

const meta = {
  title: "ui/inputs/ImageDropInput",
  component: ImageDropInput,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ImageDropInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    onSelectFile: () => {},
    children: <p>Drop image here or click to upload</p>,
  },
};
