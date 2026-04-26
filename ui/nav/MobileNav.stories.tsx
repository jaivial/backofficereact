import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { Provider } from "jotai";
import { MobileNav } from "./MobileNav";
import { sessionAtom } from "../../state/atoms";
import type { BOSession } from "../../api/types";

const TEST_SESSION_ADMIN: BOSession = {
  user: {
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    roleImportance: 100,
    sectionAccess: ["reservas", "menus", "fichaje", "horarios", "facturas"],
  },
  restaurants: [{ id: 1, slug: "test-restaurant", name: "Test Restaurant" }],
  activeRestaurantId: 1,
};

const TEST_SESSION_EMPLEADO: BOSession = {
  user: {
    id: 2,
    name: "Empleado User",
    email: "empleado@example.com",
    role: "empleado",
    roleImportance: 50,
    sectionAccess: ["reservas", "fichaje"],
  },
  restaurants: [{ id: 1, slug: "test-restaurant", name: "Test Restaurant" }],
  activeRestaurantId: 1,
};

const TEST_SESSION_COCINERO: BOSession = {
  user: {
    id: 3,
    name: "Cocinero User",
    email: "cocinero@example.com",
    role: "cocinero",
    roleImportance: 30,
    sectionAccess: ["menus", "fichaje"],
  },
  restaurants: [{ id: 1, slug: "test-restaurant", name: "Test Restaurant" }],
  activeRestaurantId: 1,
};

const meta = {
  title: "UI/Navigation/MobileNav",
  component: MobileNav,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "hsl(var(--background))" },
        { name: "dark", value: "hsl(var(--background))" },
      ],
    },
  },
  argTypes: {
    pathname: {
      control: "select",
      options: [
        "/m/app/backoffice",
        "/app/reservas",
        "/app/reservas/123",
        "/m/app/fichaje",
        "/m/app/menus",
        "/m/app/settings",
      ],
      description: "Current pathname for active state",
    },
  },
} satisfies Meta<typeof MobileNav>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component that provides the session atom via initialValues
function MobileNavWithSession({
  session,
  pathname,
  className,
}: {
  session: BOSession | null;
  pathname: string;
  className?: string;
}) {
  return (
    <Provider initialValues={[[sessionAtom, session]]}>
      <MobileNav pathname={pathname} className={className} />
    </Provider>
  );
}

// Container for visual testing
function StoryContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-16 flex items-center justify-center">
      {children}
    </div>
  );
}

export const Default: Story = {
  args: {
    pathname: "/m/app/backoffice",
  },
  render: (args) => (
    <MobileNavWithSession session={null} pathname={args.pathname} className={args.className} />
  ),
};

export const NoSession: Story = {
  name: "No Session (Fallback)",
  args: {
    pathname: "/m/app/backoffice",
  },
  parameters: {
    docs: {
      description: {
        story: "No session - only Backoffice tab visible as fallback",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={null} pathname={args.pathname} className={args.className} />
  ),
};

export const AdminActiveOnBackoffice: Story = {
  name: "Admin - Backoffice Active",
  args: {
    pathname: "/m/app/backoffice",
  },
  parameters: {
    docs: {
      description: {
        story: "Admin user with Backoffice tab active",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_ADMIN} pathname={args.pathname} className={args.className} />
  ),
};

export const AdminActiveOnReservas: Story = {
  name: "Admin - Reservas Active",
  args: {
    pathname: "/app/reservas",
  },
  parameters: {
    docs: {
      description: {
        story: "Admin user with Reservas tab active",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_ADMIN} pathname={args.pathname} className={args.className} />
  ),
};

export const AdminActiveOnFichaje: Story = {
  name: "Admin - Fichaje Active",
  args: {
    pathname: "/m/app/fichaje",
  },
  parameters: {
    docs: {
      description: {
        story: "Admin user with Fichaje tab active",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_ADMIN} pathname={args.pathname} className={args.className} />
  ),
};

export const AdminActiveOnMenus: Story = {
  name: "Admin - Menus Active",
  args: {
    pathname: "/m/app/menus",
  },
  parameters: {
    docs: {
      description: {
        story: "Admin user with Menus tab active",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_ADMIN} pathname={args.pathname} className={args.className} />
  ),
};

export const AdminActiveOnSettings: Story = {
  name: "Admin - Settings Active",
  args: {
    pathname: "/m/app/settings",
  },
  parameters: {
    docs: {
      description: {
        story: "Admin user with Ajustes (Settings) tab active",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_ADMIN} pathname={args.pathname} className={args.className} />
  ),
};

export const EmpleadoActiveOnFichaje: Story = {
  name: "Empleado - Fichaje Active",
  args: {
    pathname: "/m/app/fichaje",
  },
  parameters: {
    docs: {
      description: {
        story: "Empleado user with limited access (Reservas read-only, Fichaje full). Only shows Backoffice, Reservas (read-only), and Fichaje tabs.",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_EMPLEADO} pathname={args.pathname} className={args.className} />
  ),
};

export const EmpleadoActiveOnReservas: Story = {
  name: "Empleado - Reservas Active",
  args: {
    pathname: "/app/reservas",
  },
  parameters: {
    docs: {
      description: {
        story: "Empleado user viewing Reservas",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_EMPLEADO} pathname={args.pathname} className={args.className} />
  ),
};

export const CocineroActiveOnMenus: Story = {
  name: "Cocinero - Menus Active",
  args: {
    pathname: "/m/app/menus",
  },
  parameters: {
    docs: {
      description: {
        story: "Cocinero user with limited access (Menus, Fichaje only). Only shows Backoffice, Fichaje, and Menus tabs.",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_COCINERO} pathname={args.pathname} className={args.className} />
  ),
};

export const CocineroActiveOnFichaje: Story = {
  name: "Cocinero - Fichaje Active",
  args: {
    pathname: "/m/app/fichaje",
  },
  parameters: {
    docs: {
      description: {
        story: "Cocinero user with Fichaje tab active",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_COCINERO} pathname={args.pathname} className={args.className} />
  ),
};

export const WithCustomStyling: Story = {
  name: "With Custom Class",
  args: {
    pathname: "/m/app/backoffice",
    className: "shadow-[0_-4px_20px_rgba(0,0,0,0.15)]",
  },
  parameters: {
    docs: {
      description: {
        story: "MobileNav with custom shadow class applied",
      },
    },
  },
  render: (args) => (
    <MobileNavWithSession session={TEST_SESSION_ADMIN} pathname={args.pathname} className={args.className} />
  ),
};
