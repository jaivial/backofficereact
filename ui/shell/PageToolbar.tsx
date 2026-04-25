import React, { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../shadcn/utils";

type PageToolbarProps = HTMLAttributes<HTMLDivElement> & {
  left?: ReactNode;
  right?: ReactNode;
};

export function PageToolbar({
  left,
  right,
  className,
  ...rest
}: PageToolbarProps) {
  return (
    <div className={cn("bo-toolbar", className)} {...rest}>
      <div className="bo-toolbarLeft">{left}</div>
      {right && <div className="bo-toolbarRight">{right}</div>}
    </div>
  );
}
