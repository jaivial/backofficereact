import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MenuTypeChangeModal } from "./MenuTypeChangeModal";

const meta = {
  title: "ui/widgets/menus/MenuTypeChangeModal",
  component: MenuTypeChangeModal,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof MenuTypeChangeModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  render: () => {
    const [open, setOpen] = useState(true);
    const [nextType, setNextType] = useState("a_la_carte");

    return (
      <MenuTypeChangeModal
        open={open}
        currentType="closed_conventional"
        nextType={nextType}
        saving={false}
        onClose={() => setOpen(false)}
        onNextTypeChange={setNextType}
        onConfirm={() => alert("Confirm clicked")}
      />
    );
  },
};

export const WithDifferentTypes: Story = {
  name: "With Different Types",
  render: () => {
    const [open, setOpen] = useState(true);
    const [nextType, setNextType] = useState("closed_group");

    return (
      <MenuTypeChangeModal
        open={open}
        currentType="a_la_carte"
        nextType={nextType}
        saving={false}
        onClose={() => setOpen(false)}
        onNextTypeChange={setNextType}
        onConfirm={() => alert("Confirm clicked")}
      />
    );
  },
};

export const Saving: Story = {
  name: "Saving",
  render: () => {
    const [open, setOpen] = useState(true);
    const [nextType, setNextType] = useState("special");

    return (
      <MenuTypeChangeModal
        open={open}
        currentType="closed_conventional"
        nextType={nextType}
        saving={true}
        onClose={() => setOpen(false)}
        onNextTypeChange={setNextType}
        onConfirm={() => alert("Confirm clicked")}
      />
    );
  },
};

export const SpecialMenuType: Story = {
  name: "Special Menu Type",
  render: () => {
    const [open, setOpen] = useState(true);
    const [nextType, setNextType] = useState("a_la_carte_group");

    return (
      <MenuTypeChangeModal
        open={open}
        currentType="special"
        nextType={nextType}
        saving={false}
        onClose={() => setOpen(false)}
        onNextTypeChange={setNextType}
        onConfirm={() => alert("Confirm clicked")}
      />
    );
  },
};

export const SameTypeSelected: Story = {
  name: "Same Type Selected (Confirm Disabled)",
  render: () => {
    const [open, setOpen] = useState(true);
    const [nextType, setNextType] = useState("closed_conventional");

    return (
      <MenuTypeChangeModal
        open={open}
        currentType="closed_conventional"
        nextType={nextType}
        saving={false}
        onClose={() => setOpen(false)}
        onNextTypeChange={setNextType}
        onConfirm={() => alert("Confirm clicked")}
      />
    );
  },
};

export const Closed: Story = {
  name: "Closed",
  render: () => {
    const [open, setOpen] = useState(false);
    const [nextType, setNextType] = useState("a_la_carte");

    return (
      <MenuTypeChangeModal
        open={open}
        currentType="closed_conventional"
        nextType={nextType}
        saving={false}
        onClose={() => setOpen(false)}
        onNextTypeChange={setNextType}
        onConfirm={() => alert("Confirm clicked")}
      />
    );
  },
};
