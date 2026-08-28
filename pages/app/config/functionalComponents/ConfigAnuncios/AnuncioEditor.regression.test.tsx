import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
import type { AdEventListener, AdSaveRequest } from "./AnuncioEditor";
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
  it("autosaves via WS 1× delay after an edit; payload has no generation fields; server row is adopted", async () => {
    const api = baseApi();
    const sent: AdSaveRequest[] = [];
    let emit: AdEventListener = () => undefined;
    const subscribeAdEvents = (listener: AdEventListener) => { emit = listener; return () => { emit = () => undefined; }; };
    const sendAdSave = (message: AdSaveRequest) => { sent.push(message); };
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
          sendAdSave={sendAdSave}
          subscribeAdEvents={subscribeAdEvents}
          autosaveDelayMs={10}
        />,
      );
    });

    // No save button anymore; status pill starts idle and nothing is sent on mount.
    expect(screen.queryByTestId("ad-save")).toBeNull();
    expect(document.querySelector('[data-testid="ad-save-status"]')?.getAttribute("data-state")).toBe("idle");
    expect(sent).toHaveLength(0);

    const nameInput = screen.getByTestId("ad-name") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: "Nombre editado" } });
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe("ad_save");
    expect(sent[0].adId).toBe(8);
    expect(sent[0].payload).toMatchObject({ name: "Nombre editado", active: false });
    expect(sent[0].payload).not.toHaveProperty("image_generation_status");
    expect(sent[0].payload).not.toHaveProperty("image_generation_started_at");
    expect(document.querySelector('[data-testid="ad-save-status"]')?.getAttribute("data-state")).toBe("saving");

    await act(async () => {
      emit({ type: "ad_saved", reqId: sent[0].reqId, adId: 8, ad: { ...pendingAd, name: "Nombre editado" } });
      await Promise.resolve();
    });

    expect(document.querySelector('[data-testid="ad-save-status"]')?.getAttribute("data-state")).toBe("saved");
    expect((screen.getByTestId("ad-name") as HTMLInputElement).value).toBe("Nombre editado");
    // Baseline adopted: the resolved payload equals the saved one → no further saves.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(sent).toHaveLength(1);
  });

  it("ad_save_failed surfaces an error toast and flips the status pill to error", async () => {
    const api = baseApi();
    const sent: AdSaveRequest[] = [];
    let emit: AdEventListener = () => undefined;
    const subscribeAdEvents = (listener: AdEventListener) => { emit = listener; return () => { emit = () => undefined; }; };
    const sendAdSave = (message: AdSaveRequest) => { sent.push(message); };
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
          sendAdSave={sendAdSave}
          subscribeAdEvents={subscribeAdEvents}
          autosaveDelayMs={10}
        />,
      );
    });

    await act(async () => {
      fireEvent.change(screen.getByTestId("ad-name"), { target: { value: "otro nombre" } });
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(sent).toHaveLength(1);

    await act(async () => {
      emit({ type: "ad_save_failed", reqId: sent[0].reqId, adId: 8, code: "not_found", message: "Ad not found" });
      await Promise.resolve();
    });

    expect(notify).toHaveBeenCalledWith("error", "Anuncios", "Ad not found");
    expect(document.querySelector('[data-testid="ad-save-status"]')?.getAttribute("data-state")).toBe("error");
    // Skeleton state untouched by a failed save.
    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`)).toBeTruthy();
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

  // A failed enhance used to look EXACTLY like idle: the row silently reverted
  // to the old image with only a short-lived toast, which is why the user
  // believed the skeleton "didn't keep". The failed state must render a
  // persistent warning chip alongside the old image.
  it("failed status renders the old image plus a persistent failure chip", async () => {
    const failedAd: RestaurantAd = {
      id: 8,
      name: "Ad con imagen previa",
      active: false,
      content: [{ id: imageItemId, type: "image", value: "https://cdn.example/old-logo.webp" }],
      ctas: [],
      image_generation_status: "failed",
    };
    const api = baseApi();

    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={failedAd} />);
    });

    expect(document.querySelector(`[data-slot="ad-content-${imageItemId}-skeleton"]`)).toBeNull();
    const thumb = document.querySelector(`[data-slot="ad-content-${imageItemId}-thumb"]`) as HTMLImageElement | null;
    expect(thumb?.getAttribute("src")).toBe("https://cdn.example/old-logo.webp");

    const chip = document.querySelector(`[data-slot="ad-content-${imageItemId}-failed-chip"]`);
    expect(chip).toBeTruthy();
    expect(chip?.textContent).toContain("La mejora con IA falló");

    const change = document.querySelector(`[data-slot="ad-content-${imageItemId}-change"]`) as HTMLElement | null;
    expect(change?.getAttribute("data-failed")).toBe("true");
  });
});

describe("AnuncioEditor — preview device switcher (mobile/desktop)", () => {
  const adWithImage: RestaurantAd = {
    id: 8,
    name: "Ad con imagen previa",
    active: false,
    content: [{ id: imageItemId, type: "image", value: "https://cdn.example/old-logo.webp" }],
    ctas: [{ id: "cta1", text: "Reservar", color: "#436754", navigation_mode: "route", route: "/reservas", custom_url: "" }],
  };

  it("renders the device switcher and defaults to desktop layout", async () => {
    const api = baseApi();
    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={adWithImage} />);
    });

    // Editor tab is the default; open the preview to exercise the switcher.
    await act(async () => {
      fireEvent.click(screen.getByTestId("ad-mode-preview"));
    });

    expect(document.querySelector('[data-slot="ad-preview-device-switch"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="ad-preview-device-mobile"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="ad-preview-device-desktop"]')).toBeTruthy();

    const preview = document.querySelector('[data-testid="ad-preview"]');
    expect(preview?.getAttribute("data-preview-device")).toBe("desktop");
    expect(document.querySelector('[data-testid="ad-preview-device-desktop"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("toggling Móvil switches the preview layout to the <=640px variant", async () => {
    const user = userEvent.setup();
    const api = baseApi();
    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={adWithImage} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("ad-mode-preview"));
    });
    await act(async () => {
      await user.click(screen.getByTestId("ad-preview-device-mobile"));
    });

    const preview = document.querySelector('[data-testid="ad-preview"]');
    expect(preview?.getAttribute("data-preview-device")).toBe("mobile");
    expect(document.querySelector('[data-testid="ad-preview-device-mobile"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-testid="ad-preview-device-desktop"]')?.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      await user.click(screen.getByTestId("ad-preview-device-desktop"));
    });
    expect(document.querySelector('[data-testid="ad-preview"]')?.getAttribute("data-preview-device")).toBe("desktop");
  });

  it("hides the switcher when the preview tab is off (previewOpen=false path unaffected)", async () => {
    const api = baseApi();
    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={adWithImage} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ad-mode-editor"));
    });
    // The editor tab is already the default, so the preview stays closed.
    expect(document.querySelector('[data-testid="ad-preview"]')).toBeNull();
    expect(document.querySelector('[data-slot="ad-preview-device-switch"]')).toBeNull();
  });

  // Moving the image row in the editor must change where it renders in the
  // mobile preview: content order is respected (image interleaved), while the
  // desktop layout keeps its image-column-first structure.
  it("mobile preview renders the image in the editor order, desktop keeps image first", async () => {
    const api = baseApi();
    const reordered: RestaurantAd = {
      id: 8,
      name: "Ad reordenado",
      active: false,
      content: [
        { id: "t1", type: "title", value: "Titulo primero" },
        { id: imageItemId, type: "image", value: "https://cdn.example/mid.webp" },
        { id: "x1", type: "text", value: "Texto al final" },
      ],
      ctas: [],
    };

    await act(async () => {
      render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={reordered} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("ad-mode-preview"));
    });

    // Desktop: image column leads the body.
    const bodyChildrenDesktop = Array.from(document.querySelector('[data-slot="ad-preview-body"]')!.children);
    expect(bodyChildrenDesktop[0]?.getAttribute("data-slot")).toBe("ad-preview-image-col");

    await act(async () => {
      fireEvent.click(screen.getByTestId("ad-preview-device-mobile"));
    });

    // Mobile: flat body children follow the editor order title → image → text.
    const body = document.querySelector('[data-slot="ad-preview-body"]')!;
    const slots = Array.from(body.children).map((child) => child.getAttribute("data-slot"));
    expect(slots.indexOf("ad-preview-image-col")).toBeGreaterThan(slots.indexOf("ad-preview-t1"));
    expect(slots.indexOf("ad-preview-image-col")).toBeLessThan(slots.indexOf("ad-preview-x1"));
    expect(document.querySelector('[data-testid="ad-preview"]')?.getAttribute("data-preview-device")).toBe("mobile");
  });

  // Real phones never see the device switcher, but they must still get the
  // mobile DOM: useIsNarrowViewport flips the effective device after
  // hydration when matchMedia reports a <=640px viewport.
  it("natural narrow viewport renders the mobile DOM with editor order (matchMedia)", async () => {
    const api = baseApi();
    const reordered: RestaurantAd = {
      id: 8,
      name: "Ad reordenado",
      active: false,
      content: [
        { id: "t1", type: "title", value: "Titulo primero" },
        { id: imageItemId, type: "image", value: "https://cdn.example/mid.webp" },
        { id: "x1", type: "text", value: "Texto al final" },
      ],
      ctas: [],
    };

    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    try {
      await act(async () => {
        render(<AnuncioEditor api={api as never} website="https://villa.test" mode="edit" adId={8} initialAd={reordered} />);
      });
      // Open the (now default-closed) preview so the mobile DOM can hydrate.
      await act(async () => {
        fireEvent.click(screen.getByTestId("ad-mode-preview"));
      });
      await act(async () => {
        await Promise.resolve();
      });

      const preview = document.querySelector('[data-testid="ad-preview"]');
      expect(preview?.getAttribute("data-preview-device")).toBe("mobile");
      const slots = Array.from(document.querySelector('[data-slot="ad-preview-body"]')!.children).map((child) => child.getAttribute("data-slot"));
      expect(slots.indexOf("ad-preview-image-col")).toBeGreaterThan(slots.indexOf("ad-preview-t1"));
      expect(slots.indexOf("ad-preview-image-col")).toBeLessThan(slots.indexOf("ad-preview-x1"));
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });
});
