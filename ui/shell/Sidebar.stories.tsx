import React from "react";
import type { Meta, StoryObj } from "@storybook/react";

import { Sidebar } from "./Sidebar";
import { sidebarItemsForRole } from "../../lib/navigation";

const meta = {
  title: "ui/shell/Sidebar",
  component: Sidebar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  argTypes: {
    pathname: {
      control: "select",
      options: ["/app", "/app/", "/app/backoffice", "/app/backoffice/", "/app/reservas", "/app/menus", "/app/comida", "/app/miembros", "/app/fichaje", "/app/horarios", "/app/facturas"],
      description: "Current pathname for active state",
    },
    role: {
      control: "select",
      options: ["admin", "root", "metre", "jefe_cocina", "camarero", "barista"],
      description: "User role for navigation items",
    },
    roleImportance: {
      control: "number",
      description: "Role importance level (90+ for miembros access)",
    },
    sectionAccess: {
      control: "object",
      description: "Custom section access array",
    },
  },
  decorators: [
    (Story: React.ComponentType) => (
      <div data-slot="sidebar.stories-div" style={{ height: "100vh", display: "flex" }}>
        <Story />
        <main data-testid="main" style={{ flex: 1, padding: "2rem", background: "#f5f5f5" }}>
          <h1 data-slot="sidebar.stories-h1">Content Area</h1>
          <p data-slot="sidebar.stories-p">Current path shown in sidebar</p>
        </main>
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Admin - Multiple Sections",
  args: {
    pathname: "/app/reservas",
    role: "admin",
  },
};

export const AdminWithMenusActive: Story = {
  name: "Admin - Menus Active",
  args: {
    pathname: "/app/menus",
    role: "admin",
  },
};

export const AdminWithComidaActive: Story = {
  name: "Admin - Comida Active",
  args: {
    pathname: "/app/comida",
    role: "admin",
  },
};

export const AdminWithMiembrosActive: Story = {
  name: "Admin - Miembros Active",
  args: {
    pathname: "/app/miembros",
    role: "admin",
    roleImportance: 90,
  },
};

export const RootWithFullAccess: Story = {
  name: "Root - Full Access",
  args: {
    pathname: "/app/facturas",
    role: "root",
  },
};

export const MetreView: Story = {
  name: "Metre",
  args: {
    pathname: "/app/reservas",
    role: "metre",
  },
};

export const JefeCocinaView: Story = {
  name: "Jefe de Cocina",
  args: {
    pathname: "/app/comida",
    role: "jefe_cocina",
  },
};

export const CamareroWithFichaje: Story = {
  name: "Camarero - Fichaje Only",
  args: {
    pathname: "/app/fichaje",
    role: "camarero",
  },
};

export const BaristaView: Story = {
  name: "Barista",
  args: {
    pathname: "/app/horarios",
    role: "barista",
  },
};

export const HomeBackoffice: Story = {
  name: "Home - Backoffice",
  args: {
    pathname: "/app/backoffice",
    role: "admin",
  },
};

export const HomeApp: Story = {
  name: "Home - App Root",
  args: {
    pathname: "/app",
    role: "admin",
  },
};

export const NestedRoute: Story = {
  name: "Nested Route Active",
  args: {
    pathname: "/app/reservas/123/details",
    role: "admin",
  },
};

export const CustomSectionAccess: Story = {
  name: "Custom Section Access",
  args: {
    pathname: "/app/menus",
    role: "admin",
    sectionAccess: ["reservas", "menus", "comida"],
  },
};

export const AdminNoMiembrosAccess: Story = {
  name: "Admin - No Miembros Access",
  args: {
    pathname: "/app/reservas",
    role: "admin",
    roleImportance: 50,
  },
};

export const WithLowRoleImportance: Story = {
  name: "Low Role Importance (30)",
  args: {
    pathname: "/app/fichaje",
    role: "admin",
    roleImportance: 30,
  },
};

export const AllRolesOverview: Story = {
  name: "All Roles - Navigation Items Overview",
  render: function Render() {
    const roles = ["root", "admin", "metre", "jefe_cocina", "camarero", "barista"] as const;

    return (
      <div data-slot="sidebar.stories-div" style={{ padding: "2rem", background: "#fff", minHeight: "100vh" }}>
        <h2 data-slot="sidebar.stories-h2" style={{ marginBottom: "1rem" }}>Sidebar Items by Role</h2>
        <div data-slot="sidebar.stories-div" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1.5rem" }}>
          {roles.map((role) => {
            const items = sidebarItemsForRole(role);
            return (
              <div data-slot="sidebar.stories-div" key={role} style={{ border: "1px solid #e5e5e5", borderRadius: "8px", padding: "1rem" }}>
                <h3 data-slot="sidebar.stories-h3" style={{ fontSize: "1rem", fontWeight: 600, margin: "0 0 0.5rem 0", textTransform: "capitalize" }}>{role.replace("_", " ")}</h3>
                <p data-slot="sidebar.stories-p" style={{ fontSize: "0.75rem", color: "#666", margin: "0 0 0.5rem 0" }}>
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </p>
                <ul data-slot="sidebar.stories-ul" style={{ fontSize: "0.875rem", margin: 0, paddingLeft: "1.25rem" }}>
                  {items.map((item) => (
                    <li data-slot="sidebar.stories-li" key={item.key}>{item.label}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    );
  },
  parameters: {
    layout: "fullscreen",
  },
};

export const EmptySectionAccess: Story = {
  name: "Empty Section Access",
  args: {
    pathname: "/app",
    role: "admin",
    sectionAccess: [],
  },
};
