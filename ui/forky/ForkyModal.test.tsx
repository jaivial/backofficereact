import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ForkyButton } from "./ForkyButton";
import { ForkyModal } from "./ForkyModal";

vi.mock("./forkyRuntime", () => ({
  ForkyRuntimeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="forky-runtime">{children}</div>
  ),
}));

vi.mock("./forkyStatus", () => ({
  useForkyVisualState: () => "idle",
}));

vi.mock("./Forky3DViewer", () => ({
  Forky3DViewer: () => <div data-testid="forky-canvas" />,
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
  document.body.innerHTML = "";
});

describe("Forky widget", () => {
  it("renders the floating button with an accessible label", () => {
    render(
      <>
        <ForkyButton />
        <ForkyModal />
      </>
    );
    const button = screen.getByTestId("forky-button");
    expect(button).toHaveAttribute("aria-label", "Abrir asistente Forky");
    expect(button.querySelector("img")).toHaveAttribute("src", "/assets/forky/forky-preview.png");
  });

  it("prefetches the viewer when the button receives focus", async () => {
    const preloadForkyModel = vi.fn();
    vi.doMock("./Forky3DViewer", () => ({
      Forky3DViewer: () => <div data-testid="forky-canvas" />,
      preloadForkyModel,
    }));
    render(<ForkyButton />);
    fireEvent.focus(screen.getByTestId("forky-button"));
    await vi.waitFor(() => expect(preloadForkyModel).toHaveBeenCalled());
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

  it("closes via the close button", () => {
    render(
      <>
        <ForkyButton />
        <ForkyModal />
      </>
    );
    fireEvent.click(screen.getByTestId("forky-button"));
    fireEvent.click(screen.getByTestId("forky-close"));
    expect(screen.queryByTestId("forky-modal")).toBeNull();
  });

  it("locks body scroll while open", () => {
    render(
      <>
        <ForkyButton />
        <ForkyModal />
      </>
    );
    fireEvent.click(screen.getByTestId("forky-button"));
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
  });
});
