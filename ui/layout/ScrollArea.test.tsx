import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ScrollArea } from "./ScrollArea";

function mockResizeObserver(
  cb: (entries: ResizeObserverEntry[]) => void,
): ResizeObserver {
  return { observe: () => {}, unobserve: () => {}, disconnect: () => {} };
}

beforeAll(() => {
  globalThis.ResizeObserver = vi.fn(mockResizeObserver) as any;
});

function mockViewport(
  container: HTMLElement,
  overrides: { scrollHeight?: number; clientHeight?: number; scrollTop?: number },
) {
  const vp = container.querySelector<HTMLDivElement>(
    "[data-slot='scroll-area-viewport']",
  )!;
  Object.defineProperties(vp, {
    scrollHeight: { value: overrides.scrollHeight ?? 0, configurable: true },
    clientHeight: { value: overrides.clientHeight ?? 0, configurable: true },
    scrollTop: { value: overrides.scrollTop ?? 0, configurable: true },
  });
  return vp;
}

describe("ScrollArea", () => {
  it("renders children", () => {
    render(
      <ScrollArea>
        <p>contenido</p>
      </ScrollArea>,
    );
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });

  it("applies className to wrapper", () => {
    const { container } = render(
      <ScrollArea className="extra-class">
        <p>contenido</p>
      </ScrollArea>,
    );
    const wrapper = container.querySelector("[data-slot='scroll-area']");
    expect(wrapper).toHaveClass("extra-class");
  });

  it("uses custom dataSlot", () => {
    const { container } = render(
      <ScrollArea dataSlot="my-scroll">
        <p>contenido</p>
      </ScrollArea>,
    );
    expect(container.querySelector("[data-slot='my-scroll']")).toBeInTheDocument();
  });

  it("defaults data-slot to scroll-area", () => {
    const { container } = render(
      <ScrollArea>
        <p>contenido</p>
      </ScrollArea>,
    );
    expect(container.querySelector("[data-slot='scroll-area']")).toBeInTheDocument();
  });

  it("has viewport with scroll-area-viewport data-slot", () => {
    const { container } = render(
      <ScrollArea>
        <p>contenido</p>
      </ScrollArea>,
    );
    expect(container.querySelector("[data-slot='scroll-area-viewport']")).toBeInTheDocument();
  });

  it("hides scrollbar when content fits (scrollHeight <= clientHeight)", async () => {
    const { container } = render(
      <ScrollArea>
        <div style={{ height: 50 }}>short content</div>
      </ScrollArea>,
    );

    const vp = mockViewport(container, {
      scrollHeight: 200,
      clientHeight: 400,
    });

    await act(async () => {
      vp.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(
        container.querySelector("[data-slot='scroll-area-bar']"),
      ).not.toBeInTheDocument();
    });
  });

  it("shows scrollbar when content overflows", async () => {
    const { container } = render(
      <ScrollArea>
        <div style={{ height: 1000 }}>tall content</div>
      </ScrollArea>,
    );

    const vp = mockViewport(container, {
      scrollHeight: 1000,
      clientHeight: 200,
    });

    await act(async () => {
      vp.dispatchEvent(new Event("scroll"));
    });

    await waitFor(() => {
      expect(
        container.querySelector("[data-slot='scroll-area-bar']"),
      ).toBeInTheDocument();
    });

    const thumb = container.querySelector("[data-slot='scroll-area-thumb']");
    expect(thumb).toBeInTheDocument();
    expect((thumb as HTMLElement).style.height).toBeTruthy();
  });

  it("renders children inside viewport", () => {
    const { container } = render(
      <ScrollArea>
        <span>inside viewport</span>
      </ScrollArea>,
    );

    const viewport = container.querySelector("[data-slot='scroll-area-viewport']");
    expect(viewport).toContainElement(screen.getByText("inside viewport"));
  });

  it("applies maxHeight as style when provided", () => {
    const { container } = render(
      <ScrollArea maxHeight={300}>
        <p>contenido</p>
      </ScrollArea>,
    );
    const wrapper = container.querySelector("[data-slot='scroll-area']") as HTMLElement;
    expect(wrapper.style.maxHeight).toBe("300px");
  });

  it("applies maxHeight string value", () => {
    const { container } = render(
      <ScrollArea maxHeight="50vh">
        <p>contenido</p>
      </ScrollArea>,
    );
    const wrapper = container.querySelector("[data-slot='scroll-area']") as HTMLElement;
    expect(wrapper.style.maxHeight).toBe("50vh");
  });

  it("forwards style prop", () => {
    const { container } = render(
      <ScrollArea style={{ marginTop: 10 }}>
        <p>contenido</p>
      </ScrollArea>,
    );
    const wrapper = container.querySelector("[data-slot='scroll-area']") as HTMLElement;
    expect(wrapper.style.marginTop).toBe("10px");
  });
});
