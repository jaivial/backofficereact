import React, { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../shadcn/utils";
import { childTestId } from "../lib/testId";

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
  const testId = (rest as { "data-testid"?: string })["data-testid"];
  return (
    <div data-slot="pageToolbar-div" className={cn("bo-toolbar", className)} {...rest}>
      <div data-slot="pageToolbar-toolbarLeft" className="bo-toolbarLeft" data-testid={childTestId(testId, "left")}>{left}</div>
      {right && <div className="bo-toolbarRight" data-testid={childTestId(testId, "right")}>{right}</div>}
    </div>
  );
}
