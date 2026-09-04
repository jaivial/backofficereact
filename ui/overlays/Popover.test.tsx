import React, { useRef, useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Popover } from "./Popover";

function Harness({ onClose = () => {}, className = "" }: { onClose?: () => void; className?: string }) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(true);
  return (
    <div data-slot="popover.test-div">
      <button data-testid="abrir" ref={anchorRef} type="button" onClick={() => setOpen(true)}>
        Abrir
      </button>
      <Popover
        open={open}
        anchorRef={anchorRef}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        ariaLabel="Contenido"
        className={className}
      >
        <button data-testid="interno" type="button">Interno</button>
      </Popover>
    </div>
  );
}

describe("Popover", () => {
  it("renders its children when open", () => {
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "Contenido" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Interno" })).toBeInTheDocument();
  });

  it("stays out of the DOM when closed so its content is not read by assistive tech", () => {
    const anchorRef = { current: document.createElement("button") };
    render(
      <Popover open={false} anchorRef={anchorRef} onClose={() => {}} ariaLabel="Contenido">
        <span data-slot="popover.test-span">Interno</span>
      </Popover>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // Escape is the expected way out of a transient overlay.
  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the pointer goes down outside", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  // Clicking inside must not dismiss it, or no control in the popover could be used.
  it("does not close when the pointer goes down inside", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Interno" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  // Callers style it without the component knowing about their feature.
  it("accepts caller-supplied classes and styles", () => {
    render(<Harness className="my-popover" />);
    const dialog = screen.getByRole("dialog", { name: "Contenido" });
    expect(dialog.className).toContain("my-popover");
    expect(dialog.className).toContain("bo-popover");
  });
});

describe("Popover sizing", () => {
  function renderSized(props: Partial<React.ComponentProps<typeof Popover>>) {
    const anchorRef = { current: document.createElement("button") };
    document.body.appendChild(anchorRef.current);
    render(
      <Popover open anchorRef={anchorRef} onClose={() => {}} ariaLabel="Contenido" {...props}>
        <span data-slot="popover.test-span">Interno</span>
      </Popover>,
    );
    return screen.getByRole("dialog", { name: "Contenido" });
  }

  it("uses a fixed width when one is given", () => {
    expect(renderSized({ widthPx: 340 }).style.width).toBe("340px");
  });

  // A dynamic panel sizes to its content between the two bounds, so a short
  // result list is not padded out to a fixed width and a long one is not cut off.
  it("sizes to its content between a min and a max", () => {
    const dialog = renderSized({ minWidthPx: 280, maxWidthPx: 420 });
    expect(dialog.style.width).toBe("max-content");
    expect(dialog.style.minWidth).toBe("280px");
    // The cap travels as a custom property; the stylesheet clamps it against
    // the viewport with min(), which jsdom cannot evaluate. The real computed
    // width is asserted in the e2e spec.
    expect(dialog.style.getPropertyValue("--bo-popover-max")).toBe("420px");
  });

  // The class that applies the viewport clamp has to be present, or the cap
  // would be a custom property nothing reads.
  it("marks itself as content-sized so the stylesheet can clamp it", () => {
    const dialog = renderSized({ minWidthPx: 280, maxWidthPx: 420 });
    expect(dialog.className).toContain("bo-popover--auto");
  });

  it("does not mark a fixed-width panel as content-sized", () => {
    expect(renderSized({ widthPx: 340 }).className).not.toContain("bo-popover--auto");
  });
});
