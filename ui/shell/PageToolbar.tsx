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
    <div data-slot="pageToolbar-div" className={cn("bo-toolbar", className)} {...rest}>
      <div data-slot="pageToolbar-toolbarLeft" className="bo-toolbarLeft">{left}</div>
      {right && <div className="bo-toolbarRight">{right}</div>}
    </div>
  );
}
