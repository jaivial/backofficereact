import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("../../../../ui/shell/Panel", () => ({
  Panel: ({ children, "data-slot": slot }: { children: React.ReactNode; "data-slot"?: string }) => (
    <div data-slot={slot}>{children}</div>
  ),
}));
vi.mock("../../../../ui/shell/PageToolbar", () => ({ PageToolbar: ({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) => <div><div data-slot="toolbar-left">{left}</div><div data-slot="toolbar-right">{right}</div></div> }));

import { AnuncioEditor } from "./AnuncioEditor";
import type { RestaurantAd, RestaurantAdImageGenerationStatus } from "../../../../../api/types";

const baseApi = () => ({
  listAds: vi.fn(),
  createAd: vi.fn(),
  updateAd: vi.fn(),
  deleteAd: vi.fn(),
  uploadAdImage: vi.fn(),
  enhanceAdImage: vi.fn(),
  generateAdImage: vi.fn(),
});

const imageItemId = "image-1234";
const pendingAd: RestaurantAd = {
  id: 8,
  name: "Nuevo anuncio",
  active: false,
  content: [{ id: imageItemId, type: "image", value: "" }],
  ctas: [],
  image_generation_status: "pending",
  image_generation_started_at: "2026-08-27T13:52:23Z",
};

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, right: 100, bottom: 36, width: 100, height: 36, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});

describe("AnuncioEditor — rehydrate from SSR initialAd", () => {
  it("shows the in-flight skeleton row immediately when initialAd has image_generation_status='pending'", async () => {
    const api = baseApi();
    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={pendingAd} />);
    });

    const skeleton = document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`);
    expect(skeleton).toBeTruthy();
    expect(skeleton?.className).toContain("bo-skeleton");

    const text = document.querySelector(`[data-slot="ad-content-${imageItemId}-change-text"]`);
    expect(text?.textContent).toBe("Mejorando con IA...");

    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-thumb"]`)).toBeNull();

    expect(api.listAds).not.toHaveBeenCalled();
  });

  it("falls back to client fetch when initialAd is null", async () => {
    const api = baseApi();
    let resolveList: (value: { success: boolean; ads: RestaurantAd[] }) => void = () => undefined;
    api.listAds.mockImplementation(
      () => new Promise<{ success: boolean; ads: RestaurantAd[] }>((resolve) => { resolveList = resolve; }),
    );

    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={null} />);
    });

    expect(document.querySelector(`[data-slot="ads-loading"]`)).toBeTruthy();
    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`)).toBeNull();
    expect(api.listAds).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveList({ success: true, ads: [pendingAd] });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.querySelector(`[data-slot="ads-loading"]`)).toBeNull();
    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`)).toBeTruthy();
  });

  it("each non-pending status renders the empty button instead of the skeleton", async () => {
    const api = baseApi();
    for (const status of ["idle", "ready", "failed"] as RestaurantAdImageGenerationStatus[]) {
      const ad: RestaurantAd = { ...pendingAd, image_generation_status: status };
      const { unmount } = render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={ad} />);
      expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`)).toBeNull();
      expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-change"]`)).toBeTruthy();
      unmount();
    }
  });
});

describe("AnuncioEditor — save flow", () => {
  it("calls updateAd with the parsed payload and surfaces a toast on failure", async () => {
    const user = userEvent.setup();
    const api = baseApi();
    api.updateAd.mockResolvedValue({ success: false, message: "Ad not found" });
    const notify = vi.fn();

    await act(async () => {
      render(
        <AnuncioEditor
          api={api as never}
          website="https://villa.test"
          notify={notify}
          mode="edit"
          adId={8}
          initialAd={pendingAd}
        />,
      );
    });

    const save = await screen.findByTestId("ad-save");
    await user.click(save);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateAd).toHaveBeenCalledTimes(1);
    expect(api.updateAd).toHaveBeenCalledWith(
      8,
      expect.objectContaining({
        name: "Nuevo anuncio",
        active: false,
        content: expect.arrayContaining([expect.objectContaining({ id: imageItemId, type: "image", value: "" })]),
        ctas: [],
      }),
    );
    expect(notify).toHaveBeenCalledWith("error", "Anuncios", "Ad not found");
  });

  it("does not PUT the image_generation_status field — the backend rejects it", async () => {
    const user = userEvent.setup();
    const api = baseApi();
    api.updateAd.mockResolvedValue({ success: true, ad: pendingAd });

    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={pendingAd} />);
    });

    const save = await screen.findByTestId("ad-save");
    await user.click(save);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateAd).toHaveBeenCalledTimes(1);
    const sentPayload = api.updateAd.mock.calls[0][1];
    expect(sentPayload).not.toHaveProperty("image_generation_status");
    expect(sentPayload).not.toHaveProperty("image_generation_started_at");
  });

  it("surfaces the backend's 404 'Ad not found' as an error toast and preserves the skeleton", async () => {
    const user = userEvent.setup();
    const api = baseApi();
    api.updateAd.mockResolvedValue({ success: false, message: "Ad not found" });
    const notify = vi.fn();

    await act(async () => {
      render(
        <AnuncioEditor
          api={api as never}
          website="https://villa.test"
          notify={notify}
          mode="edit"
          adId={8}
          initialAd={pendingAd}
        />,
      );
    });

    const save = await screen.findByTestId("ad-save");
    await user.click(save);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(notify).toHaveBeenCalledWith("error", "Anuncios", "Ad not found");
    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`)).toBeTruthy();
    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-change-text"]`)?.textContent).toBe("Mejorando con IA...");
  });
});

describe("AnuncioEditor — replace existing image (user-reported reload bug)", () => {
  // Exact user scenario: ad 8 already had an image (old logo). User uploads a
  // new file, clicks 'Mejorar con IA' and then reloads the page. The DB state
  // mid-flight is status='pending' + content still holding the OLD url, so
  // the editor must render the skeleton (not the old image, not a blank slot).
  it("mid-flight reload (pending + old url) renders the skeleton, never the old image", async () => {
    const oldImageAd: RestaurantAd = {
      id: 8,
      name: "Ad con imagen previa",
      active: false,
      content: [{ id: imageItemId, type: "image", value: "https://cdn.example/old-logo.webp" }],
      ctas: [],
      image_generation_status: "pending",
      image_generation_started_at: "2026-08-27T15:00:00Z",
    };
    const api = baseApi();

    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={oldImageAd} />);
    });

    const skeleton = document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`);
    expect(skeleton).toBeTruthy();

    const oldThumb = document.querySelector(`[data-slot="ad-content-${imageItemId}-thumb"]`);
    expect(oldThumb).toBeNull();

    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-change-text"]`)?.textContent).toBe("Mejorando con IA...");
    expect(api.listAds).not.toHaveBeenCalled();
  });

  // After the AI finishes the DB must hold status='ready' + the NEW url, so a
  // reload swaps the skeleton for the new image. If the server-side status
  // write silently failed (the swapped-args bug fixed on the backend), the
  // ad would come back as idle + old url and the editor would re-render the
  // previous image — the exact symptom the user reported.
  it("post-flight reload (ready + new url) renders the new image, not the old one", async () => {
    const newImageAd: RestaurantAd = {
      id: 8,
      name: "Ad con imagen previa",
      active: false,
      content: [{ id: imageItemId, type: "image", value: "https://cdn.example/new-enhanced.webp" }],
      ctas: [],
      image_generation_status: "ready",
      image_generation_started_at: "2026-08-27T15:00:00Z",
    };
    const api = baseApi();

    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={newImageAd} />);
    });

    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`)).toBeNull();

    const thumb = document.querySelector(`[data-slot="ad-content-${imageItemId}-thumb"]`) as HTMLImageElement | null;
    expect(thumb).toBeTruthy();
    expect(thumb?.getAttribute("src")).toBe("https://cdn.example/new-enhanced.webp");
    expect(thumb?.getAttribute("src")).not.toContain("old-logo");
  });

  // The failure mode the swapped-args bug produced server-side: the enhance
  // finished (files uploaded) but the status never persisted, so the reload
  // came back as idle + old url. The editor cannot fix stale server data on
  // its own — this test pins down the symptom so a future regression is
  // immediately visible in CI.
  it("regression guard: idle + old url renders the old image (documents the broken server state the user saw)", async () => {
    const staleAd: RestaurantAd = {
      id: 8,
      name: "Ad con imagen previa",
      active: false,
      content: [{ id: imageItemId, type: "image", value: "https://cdn.example/old-logo.webp" }],
      ctas: [],
      image_generation_status: "idle",
    };
    const api = baseApi();

    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={staleAd} />);
    });

    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`)).toBeNull();
    const thumb = document.querySelector(`[data-slot="ad-content-${imageItemId}-thumb"]`) as HTMLImageElement | null;
    expect(thumb?.getAttribute("src")).toBe("https://cdn.example/old-logo.webp");
  });
});
