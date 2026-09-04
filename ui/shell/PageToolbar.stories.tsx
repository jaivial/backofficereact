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
      <div data-slot="pageToolbar.stories-div" style={{ display: "flex", gap: "8px" }}>
        <button data-testid="refresh">Refresh</button>
        <button data-testid="export">Export</button>
        <button data-testid="add-user">Add User</button>
      </div>
    ),
  },
};

export const WithSearch: Story = {
  name: "With Search",
  args: {
    left: (
      <input data-testid="search"
        type="search"
        placeholder="Search..."
        style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #ccc" }}
      />
    ),
    right: (
      <div data-slot="pageToolbar.stories-div" style={{ display: "flex", gap: "8px" }}>
        <button data-testid="filter">Filter</button>
        <button data-testid="create-new">Create New</button>
      </div>
    ),
  },
};

export const WithBreadcrumbs: Story = {
  name: "With Breadcrumbs",
  args: {
    left: (
      <nav data-testid="nav" style={{ fontSize: "14px", color: "#666" }}>
        Home / Settings / <strong>Users</strong>
      </nav>
    ),
    right: (
      <div data-slot="pageToolbar.stories-div" style={{ display: "flex", gap: "8px" }}>
        <button data-testid="save">Save</button>
        <button data-testid="cancel">Cancel</button>
      </div>
    ),
  },
};
