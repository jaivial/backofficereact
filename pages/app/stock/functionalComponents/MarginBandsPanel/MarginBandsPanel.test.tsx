import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MarginBandsPanel } from "./MarginBandsPanel";

function mockFetch(responses: Record<string, (init?: RequestInit) => Response>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    for (const key of Object.keys(responses)) {
      if (url.includes(key)) return responses[key](init);
    }
    return new Response(JSON.stringify({ success: true }));
  });
}

describe("MarginBandsPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads defaults when no GLOBAL scope is configured", async () => {
    const fetchMock = mockFetch({
      "/margin-scopes": () =>
        new Response(
          JSON.stringify({
            success: true,
            scopes: [],
            defaults: [
              { zone: "PURPLE", min: null, max: 25 },
              { zone: "GREEN", min: 25, max: 35 },
              { zone: "AMBER", min: 35, max: 40 },
              { zone: "RED", min: 40, max: null },
            ],
          }),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MarginBandsPanel />);
    expect(await screen.findByTestId("margin-band-b1")).toHaveValue("25");
    expect(screen.getByTestId("margin-band-b3")).toHaveValue("40");
    expect(screen.getByText(/valores por defecto/i)).toBeInTheDocument();
    expect(screen.queryByTestId("margin-bands-reset")).not.toBeInTheDocument();
  });

  it("shows the configured scope with a reset action", async () => {
    const fetchMock = mockFetch({
      "/margin-scopes": () =>
        new Response(
          JSON.stringify({
            success: true,
            scopes: [
              {
                scopeId: 7,
                scopeKind: "GLOBAL",
                label: "Global",
                targetFoodCostPct: 30,
                bands: [
                  { zone: "PURPLE", min: null, max: 20 },
                  { zone: "GREEN", min: 20, max: 30 },
                  { zone: "AMBER", min: 30, max: 38 },
                  { zone: "RED", min: 38, max: null },
                ],
              },
            ],
          }),
        ),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MarginBandsPanel />);
    expect(await screen.findByTestId("margin-band-b1")).toHaveValue("20");
    expect(screen.getByText(/Configurado a medida/i)).toBeInTheDocument();
    expect(screen.getByTestId("margin-band-target")).toHaveValue("30");
    expect(screen.getByTestId("margin-bands-reset")).toBeInTheDocument();
  });

  it("PUTs all four zones atomically on save", async () => {
    const fetchMock = mockFetch({
      "/margin-scopes": (init) => {
        if (init?.method === "PUT") {
          return new Response(JSON.stringify({ success: true, scopeId: 1 }));
        }
        return new Response(
          JSON.stringify({
            success: true,
            scopes: [],
            defaults: [
              { zone: "PURPLE", min: null, max: 25 },
              { zone: "GREEN", min: 25, max: 35 },
              { zone: "AMBER", min: 35, max: 40 },
              { zone: "RED", min: 40, max: null },
            ],
          }),
        );
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MarginBandsPanel />);
    const b1 = await screen.findByTestId("margin-band-b1");
    fireEvent.change(b1, { target: { value: "20" } });
    fireEvent.click(screen.getByTestId("margin-bands-save"));
    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
      );
      expect(putCall).toBeTruthy();
      const body = JSON.parse((putCall![1] as RequestInit).body as string);
      expect(body.scopeKind).toBe("GLOBAL");
      expect(body.bands).toHaveLength(4);
      // contiguity: PURPLE.max == GREEN.min == 20
      expect(body.bands[0].max).toBe(20);
      expect(body.bands[1].min).toBe(20);
    });
  });

  it("disables save and warns when boundaries are invalid", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/margin-scopes": () =>
          new Response(
            JSON.stringify({
              success: true,
              scopes: [],
              defaults: [
                { zone: "PURPLE", min: null, max: 25 },
                { zone: "GREEN", min: 25, max: 35 },
                { zone: "AMBER", min: 35, max: 40 },
                { zone: "RED", min: 40, max: null },
              ],
            }),
          ),
      }),
    );
    render(<MarginBandsPanel />);
    const b2 = await screen.findByTestId("margin-band-b2");
    fireEvent.change(b2, { target: { value: "10" } }); // now 25 > 10 < 40, non-increasing
    await waitFor(() =>
      expect(screen.getByTestId("margin-bands-save")).toBeDisabled(),
    );
    expect(screen.getByTestId("margin-bands-invalid")).toBeInTheDocument();
  });
});
