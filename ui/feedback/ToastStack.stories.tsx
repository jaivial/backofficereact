import type { Meta, StoryObj } from "@storybook/react";
import { Provider } from "jotai";
import type { Toast, ToastKind } from "../../state/atoms";
import { toastsAtom } from "../../state/atoms";
import { ToastStack } from "./ToastStack";

const makeToast = (kind: ToastKind, title: string, message?: string): Toast => ({
  id: `${kind}-${Math.random().toString(36).slice(2)}`,
  kind,
  title,
  message,
  createdAt: Date.now(),
  timeoutMs: 3200,
});

type StoryProps = {
  toasts: Toast[];
};

const Template = (args: StoryProps) => (
  <Provider initialValues={[[toastsAtom, args.toasts]]}>
    <ToastStack />
  </Provider>
);

const meta = {
  title: "ui/feedback/ToastStack",
  component: ToastStack,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof ToastStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  name: "Success",
  render: () => (
    <Provider initialValues={[[toastsAtom, [makeToast("success", "Order confirmed", "Your order #1234 has been placed successfully.")]]]}>
      <ToastStack />
    </Provider>
  ),
};

export const Error: Story = {
  name: "Error",
  render: () => (
    <Provider initialValues={[[toastsAtom, [makeToast("error", "Payment failed", "Please check your card details and try again.")]]]}>
      <ToastStack />
    </Provider>
  ),
};

export const Info: Story = {
  name: "Info",
  render: () => (
    <Provider initialValues={[[toastsAtom, [makeToast("info", "New update available", "Version 2.0 is ready to install.")]]]}>
      <ToastStack />
    </Provider>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  render: () => (
    <Provider
      initialValues={[[
        toastsAtom,
        [
          makeToast("success", "Changes saved", "Your profile has been updated."),
          makeToast("error", "Connection lost", "Unable to reach the server."),
          makeToast("info", "Reminder", "Your session expires in 5 minutes."),
        ],
      ]]}
    >
      <ToastStack />
    </Provider>
  ),
};

export const MultipleToasts: Story = {
  name: "Multiple Toasts",
  render: () => (
    <Provider
      initialValues={[[
        toastsAtom,
        [
          makeToast("success", "First toast"),
          makeToast("info", "Second toast", "This is a longer message that spans multiple lines to demonstrate the layout."),
          makeToast("error", "Third toast"),
        ],
      ]]}
    >
      <ToastStack />
    </Provider>
  ),
};
