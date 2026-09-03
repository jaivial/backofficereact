import type { Meta, StoryObj } from "@storybook/react";
import { NavLink } from "./NavLink";

const meta = {
  title: "ui/nav/NavLink",
  component: NavLink,
  tags: ["autodocs"],
  argTypes: {
    active: { control: "boolean" },
    href: { control: "text" },
    label: { control: "text" },
  },
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof NavLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: "Default",
  args: {
    href: "/page",
    label: "Navigation Link",
    active: false,
    children: "Link",
  },
};

export const Active: Story = {
  name: "Active",
  args: {
    href: "/page",
    label: "Navigation Link",
    active: true,
    children: "Link",
  },
};

export const HoverState: Story = {
  name: "Hover State",
  parameters: {
    backgrounds: { default: "gray" },
  },
  render: () => (
    <div data-slot="navLink.stories-div" style={{ padding: "1rem", background: "#f5f5f5" }}>
      <NavLink href="/hover-demo" active={false} label="Hover Demo">
        <span data-slot="navLink.stories-span">Hover over me</span>
      </NavLink>
    </div>
  ),
};

export const ActiveState: Story = {
  name: "Active State",
  parameters: {
    backgrounds: { default: "gray" },
  },
  render: () => (
    <div data-slot="navLink.stories-div" style={{ padding: "1rem", background: "#f5f5f5" }}>
      <NavLink href="/active-demo" active={true} label="Active Demo">
        <span data-slot="navLink.stories-span">I am active</span>
      </NavLink>
    </div>
  ),
};

export const DisabledState: Story = {
  name: "Disabled State",
  render: () => (
    <NavLink href="#" active={false} label="Disabled Link">
      <span data-slot="navLink.stories-span" style={{ opacity: 0.5, cursor: "not-allowed" }}>Disabled Link</span>
    </NavLink>
  ),
};

export const WithIcon: Story = {
  name: "With Icon",
  args: {
    href: "/dashboard",
    label: "Dashboard",
    active: false,
    children: (
      <>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        <span data-slot="navLink.stories-span">Dashboard</span>
      </>
    ),
  },
};

export const ActiveWithIcon: Story = {
  name: "Active With Icon",
  args: {
    ...WithIcon.args,
    active: true,
  },
};

export const NavigationBar: Story = {
  name: "Navigation Bar",
  parameters: {
    backgrounds: { default: "dark" },
  },
  render: () => (
    <nav data-testid="nav" style={{ display: "flex", gap: "0.5rem", padding: "1rem", background: "#1a1a1a", borderRadius: "8px" }}>
      <NavLink href="/home" active={true} label="Home">
        <span data-slot="navLink.stories-span">Home</span>
      </NavLink>
      <NavLink href="/about" active={false} label="About">
        <span data-slot="navLink.stories-span">About</span>
      </NavLink>
      <NavLink href="/services" active={false} label="Services">
        <span data-slot="navLink.stories-span">Services</span>
      </NavLink>
      <NavLink href="/contact" active={false} label="Contact">
        <span data-slot="navLink.stories-span">Contact</span>
      </NavLink>
    </nav>
  ),
};

export const MultipleLinks: Story = {
  name: "Multiple Links",
  render: () => (
    <div data-slot="navLink.stories-div" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <NavLink href="/link1" active={true} label="First Link">
        <span data-slot="navLink.stories-span">First Link (Active)</span>
      </NavLink>
      <NavLink href="/link2" active={false} label="Second Link">
        <span data-slot="navLink.stories-span">Second Link</span>
      </NavLink>
      <NavLink href="/link3" active={false} label="Third Link">
        <span data-slot="navLink.stories-span">Third Link</span>
      </NavLink>
    </div>
  ),
};
