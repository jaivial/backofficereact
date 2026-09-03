import type { Meta, StoryObj } from "@storybook/react";
import { Avatar, AvatarFallback, AvatarImage } from "./Avatar";

const meta = {
  title: "ui/shell/Avatar",
  component: Avatar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  name: "With Image",
  render: () => (
    <div data-slot="avatar.stories-gap-4" className="flex gap-4">
      <Avatar className="w-10 h-10">
        <AvatarImage
          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
          alt="John Doe"
        />
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithoutImage: Story = {
  name: "Without Image (Fallback)",
  render: () => (
    <div data-slot="avatar.stories-gap-4" className="flex gap-4">
      <Avatar className="w-10 h-10">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const SmallSize: Story = {
  name: "Small Size",
  render: () => (
    <div data-slot="avatar.stories-items-center" className="flex gap-4 items-center">
      <Avatar className="w-8 h-8">
        <AvatarImage
          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
          alt="John Doe"
        />
        <AvatarFallback className="text-xs">JD</AvatarFallback>
      </Avatar>
      <span data-slot="avatar.stories-text-gray-500" className="text-sm text-gray-500">32px</span>
    </div>
  ),
};

export const MediumSize: Story = {
  name: "Medium Size",
  render: () => (
    <div data-slot="avatar.stories-items-center" className="flex gap-4 items-center">
      <Avatar className="w-10 h-10">
        <AvatarImage
          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
          alt="John Doe"
        />
        <AvatarFallback className="text-sm">JD</AvatarFallback>
      </Avatar>
      <span data-slot="avatar.stories-text-gray-500" className="text-sm text-gray-500">40px</span>
    </div>
  ),
};

export const LargeSize: Story = {
  name: "Large Size",
  render: () => (
    <div data-slot="avatar.stories-items-center" className="flex gap-4 items-center">
      <Avatar className="w-12 h-12">
        <AvatarImage
          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
          alt="John Doe"
        />
        <AvatarFallback className="text-base">JD</AvatarFallback>
      </Avatar>
      <span data-slot="avatar.stories-text-gray-500" className="text-sm text-gray-500">48px</span>
    </div>
  ),
};

export const ExtraLargeSize: Story = {
  name: "Extra Large Size",
  render: () => (
    <div data-slot="avatar.stories-items-center" className="flex gap-4 items-center">
      <Avatar className="w-16 h-16">
        <AvatarImage
          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
          alt="John Doe"
        />
        <AvatarFallback className="text-lg">JD</AvatarFallback>
      </Avatar>
      <span data-slot="avatar.stories-text-gray-500" className="text-sm text-gray-500">64px</span>
    </div>
  ),
};

export const AllSizes: Story = {
  name: "All Sizes",
  render: () => (
    <div data-slot="avatar.stories-items-end" className="flex gap-6 items-end">
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-6 h-6">
          <AvatarImage
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
            alt="John Doe"
          />
          <AvatarFallback className="text-[8px]">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">24px</span>
      </div>
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-8 h-8">
          <AvatarImage
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
            alt="John Doe"
          />
          <AvatarFallback className="text-xs">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">32px</span>
      </div>
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-10 h-10">
          <AvatarImage
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
            alt="John Doe"
          />
          <AvatarFallback className="text-sm">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">40px</span>
      </div>
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-12 h-12">
          <AvatarImage
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
            alt="John Doe"
          />
          <AvatarFallback className="text-base">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">48px</span>
      </div>
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-16 h-16">
          <AvatarImage
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face"
            alt="John Doe"
          />
          <AvatarFallback className="text-lg">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">64px</span>
      </div>
    </div>
  ),
};

export const FallbackAllSizes: Story = {
  name: "Fallback - All Sizes",
  render: () => (
    <div data-slot="avatar.stories-items-end" className="flex gap-6 items-end">
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-6 h-6">
          <AvatarFallback className="text-[8px]">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">24px</span>
      </div>
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-8 h-8">
          <AvatarFallback className="text-xs">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">32px</span>
      </div>
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-10 h-10">
          <AvatarFallback className="text-sm">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">40px</span>
      </div>
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-12 h-12">
          <AvatarFallback className="text-base">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">48px</span>
      </div>
      <div data-slot="avatar.stories-gap-2" className="flex flex-col items-center gap-2">
        <Avatar className="w-16 h-16">
          <AvatarFallback className="text-lg">JD</AvatarFallback>
        </Avatar>
        <span data-slot="avatar.stories-text-gray-500" className="text-xs text-gray-500">64px</span>
      </div>
    </div>
  ),
};

export const DifferentInitials: Story = {
  name: "Different Initials",
  render: () => (
    <div data-slot="avatar.stories-gap-4" className="flex gap-4">
      <Avatar className="w-10 h-10">
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>
      <Avatar className="w-10 h-10">
        <AvatarFallback>JS</AvatarFallback>
      </Avatar>
      <Avatar className="w-10 h-10">
        <AvatarFallback>MK</AvatarFallback>
      </Avatar>
      <Avatar className="w-10 h-10">
        <AvatarFallback>AR</AvatarFallback>
      </Avatar>
    </div>
  ),
};
