import type { Placement } from "../constants/dateDropdown";

export type Pos = { top: number; left: number };

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function calculatePopoverPosition(
  anchor: HTMLElement,
  popover: HTMLElement | null,
  popoverWidth: number,
  popoverHeight: number,
  margin: number,
): { pos: Pos; placement: Placement } {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popRect = popover?.getBoundingClientRect();
  const popW = popRect?.width ?? popoverWidth;
  const popH = popRect?.height ?? popoverHeight;
  const left = clamp(rect.left, margin, vw - popW - margin);
  const spaceBelow = vh - rect.bottom - margin;
  const placement: Placement = spaceBelow < popH && rect.top > spaceBelow ? "top" : "bottom";
  const top =
    placement === "top" ? Math.max(margin, rect.top - margin - popH) : rect.bottom + margin;
  return { pos: { top, left }, placement };
}
