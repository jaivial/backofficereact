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
    "hover:bg-[rgba(255,255,255,0.06)] hover:text-bo-text",
    "disabled:pointer-events-none disabled:opacity-40",
    "motion-safe:active:scale-[0.96]",
    "data-[state=on]:border-[rgba(185,168,255,0.4)] data-[state=on]:bg-[rgba(185,168,255,0.16)] data-[state=on]:text-bo-accent",
  ],
  {
    variants: {
      size: {
        /** Square icon button; 32px keeps the touch target usable in the toolbar. */
        icon: "size-8 shrink-0 rounded-[8px] p-0",
        /** Text button for verbose controls such as the image width presets. */
        label: "h-8 rounded-[8px] px-2.5 text-xs font-semibold",
        /** Compact variant of `label`. */
        "label-sm": "h-7 rounded-[8px] px-2 text-[11px] font-semibold",
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
