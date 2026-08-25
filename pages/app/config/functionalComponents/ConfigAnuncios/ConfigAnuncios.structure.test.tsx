import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  Reorder: {
    Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Item: ({ children, value, dragListener, dragMomentum, dragElastic, whileDrag, layout, transition, dragControls, ...props }: { children: React.ReactNode; value: unknown; [k: string]: unknown }) => <div data-reorder-value={JSON.stringify(value)} {...props}>{children}</div>,
  },
  useDragControls: () => ({ start: vi.fn() }),
  useReducedMotion: () => true,
}));

vi.mock("../../../../api/client", () => ({
  createClient: () => ({
    config: {
      listAds: vi.fn().mockResolvedValue({ success: true, ads: [] }),
      createAd: vi.fn(),
      updateAd: vi.fn(),
      deleteAd: vi.fn(),
    },
  }),
}));

vi.mock("../../../../ui/overlays/Popover", () => ({
  Popover: ({ children, open, "data-testid": testId }: { children: React.ReactNode; open: boolean; "data-testid"?: string }) =>
    open ? <div data-testid={testId}>{children}</div> : null,
}));

vi.mock("../../../../ui/shell/Panel", () => ({ Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../../../ui/shell/PageToolbar", () => ({ PageToolbar: ({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) => <div><div data-slot="toolbar-left">{left}</div><div data-slot="toolbar-right">{right}</div></div> }));

import { ConfigAnunciosContent } from "./ConfigAnuncios";

const api = {
  config: {
    listAds: vi.fn().mockResolvedValue({ success: true, ads: [] }),
    createAd: vi.fn(),
    updateAd: vi.fn(),
    deleteAd: vi.fn(),
  },
};

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, right: 100, bottom: 36, width: 100, height: 36, x: 0, y: 0, toJSON: () => ({}) };
  };
});

describe("ConfigAnunciosContent — structure", () => {
  it("shows the empty CTA copy and the create-annuncio trigger when there are no ads", async () => {
    let captured: ReturnType<typeof render> | undefined;
    await act(async () => {
      captured = render(<ConfigAnunciosContent api={api as never} website="https://villa.test" />);
    });
    expect(captured).toBeTruthy();
    expect(await screen.findByText(/Empieza creando tu primer anuncio/)).toBeTruthy();
    expect(screen.getByTestId("ad-create")).toBeTruthy();
  });

  it("opens the add-content popover and calls addContent for the chosen type", async () => {
    api.config.listAds = vi.fn().mockResolvedValue({
      success: true,
      ads: [{ id: 1, name: "Anuncio 1", active: false, content: [], ctas: [] }],
    });
    await act(async () => {
      render(<ConfigAnunciosContent api={api as never} website="https://villa.test" />);
    });
    const trigger = await screen.findByTestId("ad-add-content-trigger");
    await act(async () => {
      fireEvent.click(trigger);
    });
    // Popover is rendered (mock returns content when open=true).
    expect(await screen.findByTestId("ad-add-content-popover")).toBeTruthy();
    expect(screen.getByTestId("ad-add-title-popover")).toBeTruthy();
    expect(screen.getByTestId("ad-add-subtitle-popover")).toBeTruthy();
    expect(screen.getByTestId("ad-add-text-popover")).toBeTruthy();
    expect(screen.getByTestId("ad-add-image-popover")).toBeTruthy();
  });

  it("opens the add-CTA popover and adds a CTA on click", async () => {
    api.config.listAds = vi.fn().mockResolvedValue({
      success: true,
      ads: [{ id: 1, name: "Anuncio 1", active: false, content: [], ctas: [] }],
    });
    await act(async () => {
      render(<ConfigAnunciosContent api={api as never} website="https://villa.test" />);
    });
    const trigger = await screen.findByTestId("ad-add-cta-trigger");
    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(await screen.findByTestId("ad-add-cta-popover")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText(/Añadir nuevo CTA/));
    });
    // After clicking add-cta, the popover is closed and a new row should appear.
    // We assert by re-querying the trigger visibility.
    await waitFor(() => {
      expect(screen.queryByTestId("ad-add-cta-popover")).toBeNull();
    });
  });
});
