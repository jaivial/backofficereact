import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MenuTypeChangeModal } from "./MenuTypeChangeModal";
// Coordination id: menu_type_codes_v1 - stories use the numeric menu_type codes.
import { MENU_TYPE } from "./menuTypeCodes";
import type { MenuTypeCode } from "./menuTypeCodes";

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
    const [nextType, setNextType] = useState<MenuTypeCode>(MENU_TYPE.A_LA_CARTE);

    return (
      <MenuTypeChangeModal
        open={open}
        currentType={MENU_TYPE.CLOSED_CONVENTIONAL}
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
    const [nextType, setNextType] = useState<MenuTypeCode>(MENU_TYPE.CLOSED_GROUP);

    return (
      <MenuTypeChangeModal
        open={open}
        currentType={MENU_TYPE.A_LA_CARTE}
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
    const [nextType, setNextType] = useState<MenuTypeCode>(MENU_TYPE.SPECIAL);

    return (
      <MenuTypeChangeModal
        open={open}
        currentType={MENU_TYPE.CLOSED_CONVENTIONAL}
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
    const [nextType, setNextType] = useState<MenuTypeCode>(MENU_TYPE.A_LA_CARTE_GROUP);

    return (
      <MenuTypeChangeModal
        open={open}
        currentType={MENU_TYPE.SPECIAL}
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
    const [nextType, setNextType] = useState<MenuTypeCode>(MENU_TYPE.CLOSED_CONVENTIONAL);

    return (
      <MenuTypeChangeModal
        open={open}
        currentType={MENU_TYPE.CLOSED_CONVENTIONAL}
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
    const [nextType, setNextType] = useState<MenuTypeCode>(MENU_TYPE.A_LA_CARTE);

    return (
      <MenuTypeChangeModal
        open={open}
        currentType={MENU_TYPE.CLOSED_CONVENTIONAL}
        nextType={nextType}
        saving={false}
        onClose={() => setOpen(false)}
        onNextTypeChange={setNextType}
        onConfirm={() => alert("Confirm clicked")}
      />
    );
  },
};
