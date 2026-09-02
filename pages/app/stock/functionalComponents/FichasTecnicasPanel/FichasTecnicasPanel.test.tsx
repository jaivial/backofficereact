import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FichasTecnicasPanel } from "./FichasTecnicasPanel";

// vi.mock factories are hoisted above imports, so shared spies live here.
const { usePageContextMock } = vi.hoisted(() => ({
  usePageContextMock: vi.fn(() => ({ urlParsed: { search: {} } })),
}));

vi.mock("vike-react/usePageContext", () => ({ usePageContext: usePageContextMock }));

// Same stub the WhatsApp connection tests use: the panel opens a live socket
// as a notification channel, and jsdom has no WebSocket.
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  emit(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>);
  }

  close = vi.fn(() => {
    this.readyState = 3;
  });
}

function sheet(id: number, name: string, imageUrl: string) {
  return {
    id, name, status: "DRAFT", portions: 4, imageUrl, usageCount: 0,
    categoryId: 0, categoryName: "Elaborado", instructions: "",
    componentCount: 2, stepCount: 1, allergens: [],
    sellingPriceGross: null, prepTimeMin: null,
  };
}

function listBody(page: number, preferences: Record<string, string> = {}) {
  const sheets = page === 1
    ? [sheet(1, "Ficha Uno", "https://cdn.test/uno.webp"), sheet(2, "Ficha Dos", "")]
    : [sheet(3, "Ficha Tres", "https://cdn.test/tres.webp")];
  return {
    success: true,
    sheets,
    page,
    pageSize: 24,
    total: 25,
    totalPages: 2,
    preferences,
  };
}

function mockFetch(preferences: Record<string, string> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("/stock/categories")) {
      return new Response(JSON.stringify({ success: true, categories: [] }));
    }
    if (url.includes("/me/preferences")) {
      return new Response(JSON.stringify({ success: true, preferences }));
    }
    const page = Number(new URL(url, "http://test.local").searchParams.get("page") || 1);
    return new Response(JSON.stringify(listBody(page, preferences)));
  });
  return { fn, calls };
}

describe("FichasTecnicasPanel", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the first page with server counts and pages via the pager", async () => {
    const { fn, calls } = mockFetch();
    vi.stubGlobal("fetch", fn);
    render(<FichasTecnicasPanel />);

    expect(await screen.findByText("Ficha Uno")).toBeInTheDocument();
    expect(screen.getByText("25 fichas")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("fichas-page-next"));
    expect(await screen.findByText("Ficha Tres")).toBeInTheDocument();

    const listUrls = calls.filter((c) => c.url.includes("technical-sheets")).map((c) => c.url);
    expect(listUrls.some((u) => u.includes("pageSize=24"))).toBe(true);
    expect(listUrls.some((u) => u.includes("page=2"))).toBe(true);
  });

  it("hydrates the show-images switch from the page preference and persists toggles", async () => {
    const { fn, calls } = mockFetch({ stockSheetsShowImages: "0" });
    vi.stubGlobal("fetch", fn);
    render(<FichasTecnicasPanel />);

    // Hydrated off: cards render without their picture.
    await screen.findByText("Ficha Uno");
    await waitFor(() => {
      expect(screen.queryByTestId("ficha-card-image")).not.toBeInTheDocument();
    });

    const toggle = screen.getByTestId("fichas-show-images") as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);

    const put = calls.find((c) => c.url.includes("/me/preferences"));
    expect(put).toBeDefined();
    expect(JSON.parse(String(put?.init?.body))).toEqual({ key: "stockSheetsShowImages", value: "1" });

    // Optimistic: the picture shows immediately after the toggle.
    expect(await screen.findByTestId("ficha-card-image")).toBeInTheDocument();
  });

  it("shows each card's picture when the switch is on and the sheet has one", async () => {
    const { fn } = mockFetch();
    vi.stubGlobal("fetch", fn);
    render(<FichasTecnicasPanel />);

    expect(await screen.findByTestId("ficha-card-image")).toHaveAttribute("src", "https://cdn.test/uno.webp");
    // A sheet without a picture keeps the plain card.
    const cardTwo = screen.getByText("Ficha Dos").closest("article");
    expect(cardTwo?.querySelector("[data-ui='ficha-card-image']")).toBeNull();
  });
});
