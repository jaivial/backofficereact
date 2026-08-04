import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, useEffect } from "react";

const preloadForkyModel = vi.fn();

import { advanceForkyAutoCycle, ForkyButton } from "./ForkyButton";
import { ForkyModal } from "./ForkyModal";
import { setForkyVisualState } from "./forkyStatus";

vi.mock("./forkyRuntime", () => ({
  ForkyRuntimeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="forky-runtime">{children}</div>
  ),
}));

vi.mock("./forkyStatus", () => ({
  useForkyVisualState: () => "idle",
  setForkyVisualState: vi.fn(),
}));

vi.mock("./Forky3DViewer", () => ({
  Forky3DViewer: ({ onAssetsReady }: { onAssetsReady?: () => void }) => {
    useEffect(() => onAssetsReady?.(), [onAssetsReady]);
    return <div data-testid="forky-canvas" />;
  },
  preloadForkyModel,
}));

vi.mock("@assistant-ui/react", () => ({
  ThreadPrimitive: {
    Root: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    Viewport: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
    Empty: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Messages: ({ className }: { className?: string }) => <div className={className}>messages</div>,
  },
  ComposerPrimitive: {
    Root: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Input: () => (
      <textarea data-testid="forky-composer-input" placeholder="Escribe un mensaje…" />
    ),
    Send: ({ children, asChild }: { children?: React.ReactNode; asChild?: boolean }) =>
      asChild ? children : <button type="button">{children}</button>,
  },
  MessagePrimitive: {
    Root: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Parts: () => <div />,
  },
}));

vi.mock("@assistant-ui/react-markdown", () => ({
  MarkdownTextPrimitive: () => <div />,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.mocked(setForkyVisualState).mockClear();
  preloadForkyModel.mockClear();
  document.body.innerHTML = "";
});

describe("Forky widget", () => {
  it("renders the floating button with an accessible label", async () => {
    render(
      <>
        <ForkyButton />
        <ForkyModal />
      </>
    );
    const button = screen.getByTestId("forky-button");
    const host = screen.getByTestId("forky-floating-host");
    expect(button).toHaveAttribute("aria-label", "Abrir asistente Forky");
    expect(host).toHaveClass("right-6", "bottom-6", "h-60", "w-60");
    expect(button).not.toHaveClass("rounded-full");
    expect(button).toHaveStyle({ borderRadius: "0px", boxShadow: "none" });
    await waitFor(() => expect(screen.getByTestId("forky-canvas")).toBeDefined());
    expect(button.querySelector("img")).toBeNull();
  });

  it("prefetches the viewer when the button receives focus", async () => {
    render(<ForkyButton />);
    await act(async () => {
      fireEvent.focus(screen.getByTestId("forky-button"));
      await vi.waitFor(() => expect(preloadForkyModel).toHaveBeenCalled());
    });
    await waitFor(() => expect(screen.getByTestId("forky-canvas")).toBeDefined());
  });

  it("cycles through all six GLB states every five seconds while closed", async () => {
    const setState = vi.mocked(setForkyVisualState);

    render(<ForkyButton />);
    await waitFor(() => expect(screen.getByTestId("forky-canvas")).toBeDefined());
    let index = 0;
    for (let step = 0; step < 6; step += 1) index = advanceForkyAutoCycle(index);

    expect(setState.mock.calls.map(([state]) => state)).toEqual([
      "greet",
      "talk",
      "think",
      "happy",
      "bend_active",
      "idle",
    ]);
  });

  it("opens the full-viewport dialog on click and closes on Escape", async () => {
    render(
      <>
        <ForkyButton />
        <ForkyModal />
      </>
    );
    expect(screen.queryByTestId("forky-modal")).toBeNull();

    fireEvent.click(screen.getByTestId("forky-button"));
    const dialog = screen.getByTestId("forky-modal");
    expect(dialog).toHaveAttribute("role", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(screen.getByTestId("forky-canvas")).toBeDefined());
    expect(screen.getByTestId("forky-runtime")).toBeDefined();
    expect(screen.getByTestId("forky-composer-input")).toBeDefined();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("forky-modal")).toBeNull();
  });

  it("closes via the close button", async () => {
    render(
      <>
        <ForkyButton />
        <ForkyModal />
      </>
    );
    fireEvent.click(screen.getByTestId("forky-button"));
    await waitFor(() => expect(screen.getByTestId("forky-canvas")).toBeDefined());
    await waitFor(() => expect(screen.getByTestId("forky-close")).toBeDefined());
    fireEvent.click(screen.getByTestId("forky-close"));
    await waitFor(() => expect(screen.queryByTestId("forky-modal")).toBeNull());
  });

  it("locks body scroll while open", async () => {
    render(
      <>
        <ForkyButton />
        <ForkyModal />
      </>
    );
    fireEvent.click(screen.getByTestId("forky-button"));
    await waitFor(() => expect(screen.getByTestId("forky-canvas")).toBeDefined());
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });
});
