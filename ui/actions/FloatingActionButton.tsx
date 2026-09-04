import React, { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "../shadcn/utils";

type FloatingActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
};

export function FloatingActionButton({
  icon,
  className,
  children,
  ...rest
}: FloatingActionButtonProps) {
  return (
    <button data-testid="button"
      type="button"
      className={cn("bo-menuFab", className)}
      {...rest}
    >
      {icon || children || <Plus size={26} />}
    </button>
  );
}
