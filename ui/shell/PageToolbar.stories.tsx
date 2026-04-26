import type { Meta, StoryObj } from "@storybook/react";
import { PageToolbar } from "./PageToolbar";

const meta = {
  title: "ui/shell/PageToolbar",
  component: PageToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof PageToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    left: <h1>Page Title</h1>,
    right: <button>Action</button>,
  },
};

export const WithLeftContentOnly: Story = {
  name: "Left Content Only",
  args: {
    left: <h1>Dashboard</h1>,
  },
};

export const WithMultipleActions: Story = {
  name: "Multiple Actions",
  args: {
    left: <h1>Users</h1>,
    right: (
      <div style={{ display: "flex", gap: "8px" }}>
        <button>Refresh</button>
        <button>Export</button>
        <button>Add User</button>
      </div>
    ),
  },
};

export const WithSearch: Story = {
  name: "With Search",
  args: {
    left: (
      <input
        type="search"
        placeholder="Search..."
        style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #ccc" }}
      />
    ),
    right: (
      <div style={{ display: "flex", gap: "8px" }}>
        <button>Filter</button>
        <button>Create New</button>
      </div>
    ),
  },
};

export const WithBreadcrumbs: Story = {
  name: "With Breadcrumbs",
  args: {
    left: (
      <nav style={{ fontSize: "14px", color: "#666" }}>
        Home / Settings / <strong>Users</strong>
      </nav>
    ),
    right: (
      <div style={{ display: "flex", gap: "8px" }}>
        <button>Save</button>
        <button>Cancel</button>
      </div>
    ),
  },
};
