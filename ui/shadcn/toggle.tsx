import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./utils";

/**
 * Toolbar button of the shadcn family, painted with the backoffice `bo-*` tokens
 * so it reads as part of the app instead of importing the neutral shadcn palette.
 *
 * It is a plain `<button>`: `aria-pressed` + `data-state` are what assistive
 * technology and the CSS need, and the browser already handles Space/Enter. When
 * `pressed` is omitted the button is an action, not a toggle. Focus is left to
 * the global `:focus-visible` outline in `reset.css`, so the indicator stays
 * identical to every other control.
 *
 * Sizes are concentric with the container they live in: an 8px radius inside a
 * 14px surface with 6px of padding.
 */
export const toggleVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap border border-transparent",
    "text-bo-muted transition-[color,background-color,border-color,transform] duration-150",
    // bo-toggle paints the resting/hover/active surfaces with the theme tokens
    // (see campaign-editor.css): the old rgba whites painted light-theme boxes
    // over the dark toolbar. Icon glyphs stay --bo-muted at rest and --bo-text
    // on hover so undo/redo and friends are readable in both themes.
    "bo-toggle",
    "hover:text-bo-text",
    "disabled:pointer-events-none disabled:opacity-40",
    "motion-safe:active:scale-[0.96]",
  ],
  {
    variants: {
      size: {
        /** Square icon button; the visual box is 36px, the touch target 44px. */
        icon: "bo-toggle--icon shrink-0 p-0",
        /** Text button for verbose controls such as the image width presets. */
        label: "bo-toggle--label px-2.5 text-xs font-semibold",
        /** Compact variant of `label`. */
        "label-sm": "bo-toggle--label-sm px-2 text-[11px] font-semibold",
      },
    },
    defaultVariants: { size: "icon" },
  },
);

export type ToggleProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> &
  VariantProps<typeof toggleVariants> & {
    /** Toggle state. Leave undefined to render a plain action button. */
    pressed?: boolean;
    onPressedChange?: (pressed: boolean) => void;
  };

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(function Toggle(
  { className, size, pressed, onPressedChange, onClick, type = "button", ...props },
  ref,
) {
  const isToggle = pressed !== undefined;
  return (
    <button
      ref={ref}
      type={type}
      className={cn(toggleVariants({ size }), className)}
      {...(isToggle ? { "aria-pressed": pressed, "data-state": pressed ? "on" : "off" } : {})}
      onClick={(event) => {
        onClick?.(event);
        if (isToggle && !event.defaultPrevented) onPressedChange?.(!pressed);
      }}
      {...props}
    />
  );
});
