import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProductionTypeToggle } from "./ProductionTypeToggle";

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => handler(String(url), init),
  })) as unknown as typeof fetch;
}

describe("ProductionTypeToggle", () => {
  beforeEach(() => {
    mockFetch(() => ({ success: true, sheets: [] }));
  });

  it("shows which production type is active without relying on colour alone", () => {
    render(<ProductionTypeToggle itemId={1} productionType="RAW" onChange={vi.fn()} />);
    const raw = screen.getByRole("radio", { name: /materia prima/i });
    expect(raw.getAttribute("aria-checked")).toBe("true");
    const manufactured = screen.getByRole("radio", { name: /preparado/i });
    expect(manufactured.getAttribute("aria-checked")).toBe("false");
  });

  it("explains what each option means so the choice is not guesswork", () => {
    render(<ProductionTypeToggle itemId={1} productionType="RAW" onChange={vi.fn()} />);
    expect(screen.getByText(/se vende tal cual/i)).toBeTruthy();
    expect(screen.getByText(/ficha t/i)).toBeTruthy();
  });

  it("persists the new type and reports it upwards", async () => {
    const calls: { url: string; body: unknown }[] = [];
    mockFetch((url, init) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      return { success: true };
    });
    const onChange = vi.fn();
    render(<ProductionTypeToggle itemId={7} productionType="RAW" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("MANUFACTURED"));
    const patch = calls.find((c) => c.url.includes("/production-type"));
    expect(patch?.url).toContain("/comida/items/7/production-type");
    expect((patch?.body as { productionType: string }).productionType).toBe("MANUFACTURED");
  });

  it("keeps the previous selection when the save fails", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({ success: false, message: "No permitido" }),
    })) as unknown as typeof fetch;
    const onChange = vi.fn();
    render(<ProductionTypeToggle itemId={7} productionType="RAW" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));

    await waitFor(() => expect(screen.getByText(/no permitido/i)).toBeTruthy());
    // A failed save must not leave the UI claiming a change that never happened.
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /materia prima/i }).getAttribute("aria-checked")).toBe("true");
  });
});

// The component is controlled: it reports a confirmed change and lets the
// parent own the value. Holding a second copy internally is what previously
// let a successful save be visually reverted.
it("reports the confirmed change instead of tracking its own copy", async () => {
  mockFetch(() => ({ success: true }));
  const onChange = vi.fn();
  const { rerender } = render(
    <ProductionTypeToggle itemId={7} productionType="RAW" onChange={onChange} />,
  );

  fireEvent.click(screen.getByRole("radio", { name: /preparado/i }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("MANUFACTURED"));

  // Until the parent applies it, the displayed value is still the parent's.
  expect(screen.getByRole("radio", { name: /materia prima/i }).getAttribute("aria-checked")).toBe("true");

  rerender(<ProductionTypeToggle itemId={7} productionType="MANUFACTURED" onChange={onChange} />);
  expect(screen.getByRole("radio", { name: /preparado/i }).getAttribute("aria-checked")).toBe("true");
});

it("shows whichever product the parent is currently displaying", () => {
  const { rerender } = render(
    <ProductionTypeToggle itemId={7} productionType="MANUFACTURED" onChange={vi.fn()} />,
  );
  expect(screen.getByRole("radio", { name: /preparado/i }).getAttribute("aria-checked")).toBe("true");

  rerender(<ProductionTypeToggle itemId={8} productionType="RAW" onChange={vi.fn()} />);
  expect(screen.getByRole("radio", { name: /materia prima/i }).getAttribute("aria-checked")).toBe("true");
});
