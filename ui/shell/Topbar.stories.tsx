import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Provider as JotaiProvider } from "jotai";

import { Topbar } from "./Topbar";
import { sessionAtom, fichajeRealtimeAtom } from "../../state/atoms";
import type { BOSession, FichajeRealtimeState } from "../../state/atoms";
import type { BreadcrumbItem } from "../nav/Breadcrumbs";

const mockBreadcrumbs: BreadcrumbItem[] = [
  { label: "Backoffice", href: "/app/backoffice" },
  { label: "Reservas", href: "/app/reservas" },
  { label: "Current Page" },
];

// Helper to create mock session data
const createMockSession = (overrides: Partial<BOSession> = {}): BOSession => ({
  user: {
    id: 1,
    email: "admin@restaurant.com",
    name: "Admin User",
    role: "admin",
    roleImportance: 100,
    sectionAccess: ["reservas", "menus", "ajustes", "miembros", "fichaje", "horarios"],
  },
  restaurants: [
    { id: 1, slug: "main", name: "Restaurante Principal" },
    { id: 2, slug: "branch", name: "Sucursal Norte" },
  ],
  activeRestaurantId: 1,
  ...overrides,
});

// Mock fichaje states
const mockFichajeInactive: FichajeRealtimeState = {
  wsConnected: false,
  wsConnecting: false,
  restaurantId: null,
  lastSyncAt: null,
  member: null,
  activeEntriesByMember: {},
  activeEntry: null,
  scheduleToday: null,
  pendingScheduleUpdates: false,
};

const mockFichajeActive: FichajeRealtimeState = {
  wsConnected: true,
  wsConnecting: false,
  restaurantId: 1,
  lastSyncAt: Date.now(),
  member: { id: 1, name: "Admin User" },
  activeEntriesByMember: {
    1: {
      id: 1,
      memberId: 1,
      type: "entrada",
      startAtIso: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      restaurantId: 1,
    },
  },
  activeEntry: {
    id: 1,
    memberId: 1,
    type: "entrada",
    startAtIso: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    restaurantId: 1,
  },
  scheduleToday: null,
  pendingScheduleUpdates: false,
};

// Wrapper component that sets atom values
const WithAtoms: React.FC<{
  session: BOSession | null;
  fichaje: FichajeRealtimeState;
  children: React.ReactNode;
}> = ({ session, fichaje, children }) => {
  return (
    <JotaiProvider
      initialValues={[
        [sessionAtom, session],
        [fichajeRealtimeAtom, fichaje],
      ]}
    >
      {children}
    </JotaiProvider>
  );
};

const meta = {
  title: "shell/Topbar",
  component: Topbar,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Topbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    title: "Dashboard",
  },
  render: (args) => (
    <WithAtoms session={createMockSession()} fichaje={mockFichajeInactive}>
      <Topbar {...args} />
    </WithAtoms>
  ),
  parameters: {
    docs: {
      description: {
        story: "Default Topbar with just a title, showing user menu and restaurant selector.",
      },
    },
  },
};

export const WithBreadcrumbs: Story = {
  name: "With Breadcrumbs",
  args: {
    title: "Anadir reserva",
    breadcrumbs: mockBreadcrumbs,
  },
  render: (args) => (
    <WithAtoms session={createMockSession()} fichaje={mockFichajeInactive}>
      <Topbar {...args} />
    </WithAtoms>
  ),
  parameters: {
    docs: {
      description: {
        story: "Topbar with breadcrumb navigation displayed below the title.",
      },
    },
  },
};

export const WithActiveFichaje: Story = {
  name: "With Active Fichaje",
  args: {
    title: "Fichaje",
  },
  render: (args) => (
    <WithAtoms session={createMockSession()} fichaje={mockFichajeActive}>
      <Topbar {...args} />
    </WithAtoms>
  ),
  parameters: {
    docs: {
      description: {
        story: "Topbar with active clock-in showing elapsed time with live indicator.",
      },
    },
  },
};

export const WithMultipleRestaurants: Story = {
  name: "With Multiple Restaurants",
  args: {
    title: "Gestion",
  },
  render: (args) => (
    <WithAtoms session={createMockSession()} fichaje={mockFichajeInactive}>
      <Topbar {...args} />
    </WithAtoms>
  ),
  parameters: {
    docs: {
      description: {
        story: "Topbar with restaurant selector dropdown showing multiple available restaurants.",
      },
    },
  },
};

export const SingleRestaurant: Story = {
  name: "Single Restaurant",
  args: {
    title: "Reservas",
  },
  render: (args) => (
    <WithAtoms
      session={createMockSession({
        restaurants: [{ id: 1, slug: "main", name: "Restaurante Principal" }],
      })}
      fichaje={mockFichajeInactive}
    >
      <Topbar {...args} />
    </WithAtoms>
  ),
  parameters: {
    docs: {
      description: {
        story: "Topbar with a single restaurant - no selector shown.",
      },
    },
  },
};

export const WithoutSession: Story = {
  name: "Without Session",
  args: {
    title: "Loading...",
  },
  render: (args) => (
    <WithAtoms session={null} fichaje={mockFichajeInactive}>
      <Topbar {...args} />
    </WithAtoms>
  ),
  parameters: {
    docs: {
      description: {
        story: "Topbar when user is not logged in - no user menu or restaurant selector.",
      },
    },
  },
};

export const LongTitle: Story = {
  name: "Long Title",
  args: {
    title: "Configuracion de Reservas y Disponibilidad del Restaurante",
    breadcrumbs: mockBreadcrumbs,
  },
  render: (args) => (
    <WithAtoms session={createMockSession()} fichaje={mockFichajeInactive}>
      <Topbar {...args} />
    </WithAtoms>
  ),
  parameters: {
    docs: {
      description: {
        story: "Topbar with a long title and breadcrumbs.",
      },
    },
  },
};

export const EmployeeView: Story = {
  name: "Employee View",
  render: () => (
    <WithAtoms
      session={createMockSession({
        user: {
          id: 3,
          email: "employee@restaurant.com",
          name: "Employee Name",
          role: "employee",
          roleImportance: 20,
          sectionAccess: ["fichaje", "horarios"],
        },
        restaurants: [{ id: 1, slug: "main", name: "Restaurante Principal" }],
      })}
      fichaje={mockFichajeActive}
    >
      <Topbar
        title="Mi Horario"
        breadcrumbs={[
          { label: "Backoffice", href: "/app/backoffice" },
          { label: "Miembros", href: "/app/miembros" },
          { label: "Mi Horario" },
        ]}
      />
    </WithAtoms>
  ),
  parameters: {
    docs: {
      description: {
        story: "Employee view with limited access and active fichaje.",
      },
    },
  },
};

export const ManagerView: Story = {
  name: "Manager View",
  render: () => (
    <WithAtoms
      session={createMockSession({
        user: {
          id: 2,
          email: "manager@restaurant.com",
          name: "Manager User",
          role: "manager",
          roleImportance: 80,
          sectionAccess: ["reservas", "menus", "fichaje"],
        },
        restaurants: [
          { id: 1, slug: "main", name: "Restaurante Principal" },
          { id: 2, slug: "north", name: "Sucursal Norte" },
          { id: 3, slug: "south", name: "Sucursal Sur" },
        ],
      })}
      fichaje={mockFichajeInactive}
    >
      <Topbar
        title="Dashboard"
        breadcrumbs={[{ label: "Backoffice", href: "/app/backoffice" }]}
      />
    </WithAtoms>
  ),
  parameters: {
    docs: {
      description: {
        story: "Manager view with multiple restaurants and broader access.",
      },
    },
  },
};
