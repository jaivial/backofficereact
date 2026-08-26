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

vi.mock("../../../../ui/overlays/Popover", () => ({
  Popover: ({ children, open, "data-testid": testId }: { children: React.ReactNode; open: boolean; "data-testid"?: string }) =>
    open ? <div data-testid={testId}>{children}</div> : null,
}));

vi.mock("../../../../ui/shell/Panel", () => ({ Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("../../../../ui/shell/PageToolbar", () => ({ PageToolbar: ({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) => <div><div data-slot="toolbar-left">{left}</div><div data-slot="toolbar-right">{right}</div></div> }));

import { AnuncioEditor } from "./AnuncioEditor";
import type { RestaurantAd } from "../../../../../api/types";

const baseApi = () => ({
  listAds: vi.fn().mockResolvedValue({ success: true, ads: [] }),
  createAd: vi.fn(),
  updateAd: vi.fn(),
  deleteAd: vi.fn(),
  uploadAdImage: vi.fn(),
  enhanceAdImage: vi.fn(),
  generateAdImage: vi.fn(),
});

const sampleAd: RestaurantAd = {
  id: 1,
  name: "Anuncio 1",
  active: false,
  content: [],
  ctas: [],
};

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, right: 100, bottom: 36, width: 100, height: 36, x: 0, y: 0, toJSON: () => ({}) };
  };
});

describe("AnuncioEditor — structure", () => {
  it("renders the create-annuncio shell (mode=create) with a save trigger", async () => {
    const api = baseApi();
    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="create" initialAd={sampleAd} />);
    });
    expect(await screen.findByTestId("ad-save")).toBeTruthy();
    expect(screen.getByTestId("ad-add-content-trigger")).toBeTruthy();
  });

  it("opens the add-content popover and exposes the four content types", async () => {
    const api = baseApi();
    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" initialAd={sampleAd} />);
    });
    const trigger = await screen.findByTestId("ad-add-content-trigger");
    await act(async () => {
      fireEvent.click(trigger);
    });
    expect(await screen.findByTestId("ad-add-content-popover")).toBeTruthy();
    expect(screen.getByTestId("ad-add-title-popover")).toBeTruthy();
    expect(screen.getByTestId("ad-add-subtitle-popover")).toBeTruthy();
    expect(screen.getByTestId("ad-add-text-popover")).toBeTruthy();
    expect(screen.getByTestId("ad-add-image-popover")).toBeTruthy();
  });

  it("wraps each row in .bo-anunciosRowField and the action in .bo-anunciosRowAction", async () => {
    const api = baseApi();
    const ad: RestaurantAd = {
      id: 1,
      name: "Anuncio 1",
      active: false,
      content: [{ id: "t1", type: "title", value: "Titulo" }],
      ctas: [{ id: "cta1", text: "Reservar", color: "#436754", navigation_mode: "route", route: "/reservas", custom_url: "" }],
    };
    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" initialAd={ad} />);
    });
    const fields = document.querySelectorAll(".bo-anunciosRowField");
    const actions = document.querySelectorAll(".bo-anunciosRowAction");
    expect(fields.length).toBeGreaterThanOrEqual(2);
    expect(actions.length).toBeGreaterThanOrEqual(2);
    const ctaFields = document.querySelector('[data-slot$="-fields"]');
    expect(ctaFields?.classList.contains("bo-anunciosRowField-2col")).toBe(true);
  });

  it("adds a CTA from the unified add menu and closes it", async () => {
    const api = baseApi();
    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" initialAd={sampleAd} />);
    });
    const trigger = await screen.findByTestId("ad-add-content-trigger");
    await act(async () => {
      fireEvent.click(trigger);
    });
    const popover = screen.getByTestId("ad-add-content-popover");
    expect(popover).toBeTruthy();
    expect(screen.queryByTestId("ad-add-cta-trigger")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByText(/Añadir nuevo CTA/));
    });
    await waitFor(() => {
      expect(screen.queryByTestId("ad-add-content-popover")).toBeNull();
    });
    expect(document.querySelector('[data-slot^="ad-cta-"]')).toBeTruthy();
  });
});
