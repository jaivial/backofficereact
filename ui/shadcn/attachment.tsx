import React from "react";

import { cn } from "./utils";

/**
 * shadcn/ui `Attachment` (base-rhea) adapted to this repo.
 * Source: https://ui.shadcn.com/docs/components/base/attachment
 * Coordination id: booking_documents_v1
 *
 * What changed against the registry version:
 * - `AttachmentTrigger` uses the repo's `Button asChild` (radix Slot) instead of
 *   base-ui `useRender`, so the overlay click target keeps the bo-btn look
 *   without pulling @base-ui/react in.
 * - Sizes map to the repo button sizes (`sm` / `icon` / default) because the
 *   local shadcn Button has no `icon-xs` variant.
 * - No tailwind token classes: the visual rules live in bo-attachment*.css.
 */

export type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done";

function Attachment({
  className,
  state = "done",
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { state?: AttachmentState; size?: "default" | "sm" }) {
  return (
    <div
      data-slot="attachment"
      data-state={state}
      data-size={size}
      className={cn("bo-attachment", size === "sm" ? "bo-attachment--sm" : undefined, className)}
      {...props}
    />
  );
}

function AttachmentMedia({ className, variant = "icon", ...props }: React.ComponentProps<"div"> & { variant?: "icon" | "image" }) {
  return (
    <div
      data-slot="attachment-media"
      data-variant={variant}
      className={cn("bo-attachmentMedia", className)}
      {...props}
    />
  );
}

function AttachmentContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="attachment-content" className={cn("bo-attachmentContent", className)} {...props} />;
}

function AttachmentTitle({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="attachment-title" className={cn("bo-attachmentTitle", className)} {...props} />;
}

function AttachmentDescription({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="attachment-description" className={cn("bo-attachmentDescription", className)} {...props} />;
}

function AttachmentActions({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="attachment-actions" className={cn("bo-attachmentActions", className)} {...props} />;
}

function AttachmentAction({ className, size = "icon", ...props }: React.ComponentProps<"button"> & { size?: "sm" | "icon" }) {
  return (
    <button
      type="button"
      data-slot="attachment-action"
      className={cn("bo-attachmentAction", size === "sm" ? "bo-attachmentAction--sm" : undefined, className)}
      {...props}
    />
  );
}

function AttachmentGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="attachment-group" className={cn("bo-attachmentGroup", className)} {...props} />;
}

export {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
};
