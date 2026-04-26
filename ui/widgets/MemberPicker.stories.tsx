import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MemberPicker, MemberPickerItem } from "./MemberPicker";

const members: MemberPickerItem[] = [
  { id: 1, name: "Juan Perez", meta: "VIP", live: true },
  { id: 2, name: "Maria Garcia", meta: "Premium" },
  { id: 3, name: "Carlos Rodriguez", meta: "Standard", live: true },
  { id: 4, name: "Ana Martinez", meta: "VIP" },
  { id: 5, name: "Pedro Sanchez", live: true },
];

const meta = {
  title: "ui/widgets/MemberPicker",
  component: MemberPicker,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof MemberPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  render: () => {
    const [searchValue, setSearchValue] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const filteredItems = members.filter((m) =>
      m.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    return (
      <MemberPicker
        title="Miembros"
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        items={filteredItems}
        selectedId={selectedId}
        onSelect={setSelectedId}
        emptyLabel="No hay miembros"
      />
    );
  },
};

export const WithSelection: Story = {
  name: "With Selection",
  render: () => {
    const [searchValue, setSearchValue] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(1);

    const filteredItems = members.filter((m) =>
      m.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    return (
      <MemberPicker
        title="Miembros"
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        items={filteredItems}
        selectedId={selectedId}
        onSelect={setSelectedId}
        emptyLabel="No hay miembros"
      />
    );
  },
};

export const WithSearchFilter: Story = {
  name: "With Search Filter",
  render: () => {
    const [searchValue, setSearchValue] = useState("Maria");
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const filteredItems = members.filter((m) =>
      m.name.toLowerCase().includes(searchValue.toLowerCase())
    );

    return (
      <MemberPicker
        title="Miembros"
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        items={filteredItems}
        selectedId={selectedId}
        onSelect={setSelectedId}
        emptyLabel="No hay miembros"
      />
    );
  },
};

export const EmptyState: Story = {
  name: "Empty State",
  render: () => {
    const [searchValue, setSearchValue] = useState("");
    const [selectedId, setSelectedId] = useState<number | null>(null);

    return (
      <MemberPicker
        title="Miembros"
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        items={[]}
        selectedId={selectedId}
        onSelect={setSelectedId}
        emptyLabel="No hay miembros"
      />
    );
  },
};
