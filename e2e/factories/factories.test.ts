import { describe, it, expect, vi } from "vitest";
import { makeBookingFactory } from "./booking";
import { makeComidaFactory } from "./comida";
import { makeMenuFactory } from "./menu";
import { makePOSVisitFactory } from "./pos-visit";
import type { TestApiClient } from "../helpers/api-client";

function mockApiClient(): TestApiClient {
  return {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  } as unknown as TestApiClient;
}

describe("factories — create + cleanup contracts", () => {
  it("bookingFactory: create POSTs, cleanup cancels", async () => {
    const api = mockApiClient();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, booking: { id: 42 } });
    const { factory, cleanup } = makeBookingFactory(api);

    const b = await factory.create();
    expect(b.id).toBe(42);
    expect(api.post).toHaveBeenCalledWith("/api/admin/bookings", expect.objectContaining({ party_size: 2 }));

    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    await cleanup();
    expect(api.post).toHaveBeenCalledWith("/api/admin/bookings/42/cancel", {});
  });

  it("comidaFactory: create POSTs with tipo, cleanup DELETEs", async () => {
    const api = mockApiClient();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, num: 7, item: {} });
    const { factory, cleanup } = makeComidaFactory(api);

    const item = await factory.create("platos", { precio: 20 });
    expect(item.num).toBe(7);
    expect(api.post).toHaveBeenCalledWith("/api/admin/comida/platos", expect.objectContaining({ precio: 20 }));

    await cleanup();
    expect(api.delete).toHaveBeenCalledWith("/api/admin/comida/platos/7");
  });

  it("menuFactory: create returns menu_id, cleanup DELETEs", async () => {
    const api = mockApiClient();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, menu_id: 99 });
    const { factory, cleanup } = makeMenuFactory(api);

    const m = await factory.create({ menu_type: "special" });
    expect(m.id).toBe(99);
    expect(api.post).toHaveBeenCalledWith("/api/admin/group-menus-v2/drafts", expect.objectContaining({ menu_type: "special" }));

    await cleanup();
    expect(api.delete).toHaveBeenCalledWith("/api/admin/group-menus-v2/99");
  });

  it("posVisitFactory: cleanup cancels each visit", async () => {
    const api = mockApiClient();
    (api.post as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ success: true, id: 10 })
      .mockResolvedValueOnce({ success: true, id: 11 })
      .mockResolvedValue({ success: true });
    const { factory, cleanup } = makePOSVisitFactory(api);

    await factory.create();
    await factory.create();
    await cleanup();

    expect(api.post).toHaveBeenCalledWith("/api/admin/pos/visits/10/cancel", {});
    expect(api.post).toHaveBeenCalledWith("/api/admin/pos/visits/11/cancel", {});
  });

  it("factory cleanup swallows delete errors (already-deleted)", async () => {
    const api = mockApiClient();
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, num: 5 });
    (api.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("409 conflict"));
    const { factory, cleanup } = makeComidaFactory(api);

    await factory.create("vinos");
    // Should not throw despite delete rejection.
    await expect(cleanup()).resolves.toBeUndefined();
  });
});
