import React from "react";
import { cn } from "../../../../ui/shadcn/utils";

/*
 * Reusable iPhone mockup: metal bezel with side buttons, dynamic island, iOS
 * status bar and a screen area the caller fills. Pure CSS + Tailwind, no images
 * and no dependency: every React device-mockup library on npm is abandoned on
 * React <= 17 (checked 2026-09: react-device-mockups@0.1.12, react-device-frames
 * @1.0.0, react-device-preview@1.0.6), so a dependency-free frame is the safe
 * pick for a live product.
 *
 * Presentational only, therefore SSR safe: fixed pixel geometry (no measuring,
 * no media queries), no browser APIs and a deterministic clock.
 */

export const IPHONE_FRAME_WIDTH = 320;
export const IPHONE_FRAME_HEIGHT = 640;
/** Height of the status bar strip: children are painted behind it, like on iOS. */
export const IPHONE_STATUSBAR_HEIGHT = 44;
/** Fixed clock so server and client markup match byte for byte. */
export const IPHONE_DEFAULT_TIME = "9:41";

/** Side buttons, laid out from the frame edges with fixed offsets. */
const SIDE_BUTTONS = [
  { id: "mute", testId: "iphone-frame-btn-mute", className: "-left-[3px] top-[104px] h-[22px]" },
  { id: "volume-up", testId: "iphone-frame-btn-volume-up", className: "-left-[3px] top-[152px] h-[46px]" },
  { id: "volume-down", testId: "iphone-frame-btn-volume-down", className: "-left-[3px] top-[208px] h-[46px]" },
  { id: "power", testId: "iphone-frame-btn-power", className: "-right-[3px] top-[176px] h-[74px]" },
] as const;

/** Signal strength: four bars, the last one dimmed like an idle device. */
function SignalIcon() {
  return (
    <span className="flex items-end gap-[2px]" data-testid="iphone-frame-signal" aria-hidden="true">
      {[5, 7, 9, 11].map((bar) => (
        <span key={bar} className={cn("w-[3px] rounded-[1px]", bar === 11 ? "bg-white/40" : "bg-white")} style={{ height: bar }} data-testid={`iphone-frame-signal-bar-${bar}`} />
      ))}
    </span>
  );
}

function WifiIcon() {
  return (
    <svg width="15" height="11" viewBox="0 0 16 12" fill="none" aria-hidden="true" data-testid="iphone-frame-wifi">
      <path d="M8 11 5.5 8.4a3.6 3.6 0 0 1 5 0L8 11Z" fill="currentColor" />
      <path d="M3.4 6.2a6.6 6.6 0 0 1 9.2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M1.2 3.8a9.6 9.6 0 0 1 13.6 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <span className="flex items-center gap-[1px]" data-testid="iphone-frame-battery" aria-hidden="true">
      <span className="flex h-[11px] w-[22px] items-center rounded-[3px] border border-white/70 p-[1.5px]" data-testid="iphone-frame-battery-shell">
        <span className="h-full w-[70%] rounded-[1.5px] bg-white" data-testid="iphone-frame-battery-level" />
      </span>
      <span className="h-[4px] w-[2px] rounded-r-[1px] bg-white/70" data-testid="iphone-frame-battery-cap" />
    </span>
  );
}

export type IPhoneFrameProps = {
  /** Screen content: painted edge to edge, behind the status bar. */
  children: React.ReactNode;
  /** Accessible name of what is on screen (also the sr-only caption). */
  title?: string;
  /** Clock shown on the status bar. */
  time?: string;
  className?: string;
  testId?: string;
};

/**
 * iPhone device frame. The status bar and the island float over the screen, so
 * the child decides which colour sits behind them (an app header, a wallpaper).
 */
export function IPhoneFrame({ children, title = "iPhone", time = IPHONE_DEFAULT_TIME, className, testId = "iphone-frame" }: IPhoneFrameProps) {
  return (
    <div
      className={cn("relative shrink-0 select-none", className)}
      style={{ width: IPHONE_FRAME_WIDTH }}
      role="group"
      aria-label={title}
      data-testid={testId}
      data-observe="iphone-frame"
    >
      <span className="sr-only" data-testid="iphone-frame-caption">
        {title}
      </span>
      {SIDE_BUTTONS.map((button) => (
        <span key={button.id} aria-hidden="true" className={cn("absolute w-[4px] rounded-[2px] bg-neutral-700", button.className)} data-testid={button.testId} />
      ))}
      <div
        className="relative rounded-[2.75rem] bg-neutral-900 p-3 shadow-[0_20px_45px_-20px_rgba(0,0,0,0.6)] ring-1 ring-black/50"
        data-testid="iphone-frame-bezel"
        data-observe="iphone-frame-bezel"
      >
        <div className="relative overflow-hidden rounded-[2.25rem] bg-white" style={{ height: IPHONE_FRAME_HEIGHT - 24 }}>
          <div
            className="absolute inset-0 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            data-testid="iphone-frame-screen"
            data-observe="iphone-frame-screen"
          >
            {children}
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-7 text-white"
            style={{ height: IPHONE_STATUSBAR_HEIGHT }}
            data-testid="iphone-frame-statusbar"
            data-observe="iphone-frame-statusbar"
          >
            <span className="text-[12px] font-semibold tracking-tight" data-testid="iphone-frame-time">
              {time}
            </span>
            <span className="flex items-center gap-[5px]" data-testid="iphone-frame-status-icons">
              <SignalIcon />
              <WifiIcon />
              <BatteryIcon />
            </span>
          </div>
          <span className="absolute left-1/2 top-2 z-30 h-[22px] w-[86px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" data-testid="iphone-frame-island" />
        </div>
      </div>
    </div>
  );
}
