import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfigMiniMax } from "./ConfigMiniMax";

const mGet = vi.fn();
const mSet = vi.fn();

vi.mock("../../../../../api/client", () => ({
  createClient: () => ({
    config: {
      getMiniMaxConfig: (...a: unknown[]) => mGet(...a),
      setMiniMaxConfig: (...a: unknown[]) => mSet(...a),
    },
  }),
}));

vi.mock("../../../../../ui/feedback/useToasts", () => ({
  useToasts: () => ({ pushToast: (t: { kind: string; title: string }) => t }),
}));

describe("ConfigMiniMax", () => {
  beforeEach(() => {
    mGet.mockReset();
    mSet.mockReset();
    mGet.mockResolvedValue({ success: true, config: { hasApiKey: true, model: "MiniMax-M2" } });
    mSet.mockResolvedValue({ success: true, config: { hasApiKey: true, model: "MiniMax-M3" } });
  });

  it("loads and shows saved state (masked key + model)", async () => {
    render(<ConfigMiniMax />);
    await waitFor(() => expect(mGet).toHaveBeenCalled());
    const input = screen.getByTestId("config-minimax-key-input") as HTMLInputElement;
    expect(input.placeholder).toContain("Clave guardada");
    expect(screen.getByTestId("config-minimax-model-select")).toBeTruthy();
  });

  it("saves a typed key and model", async () => {
    const user = userEvent.setup();
    render(<ConfigMiniMax />);
    await waitFor(() => expect(mGet).toHaveBeenCalled());

    const input = screen.getByTestId("config-minimax-key-input") as HTMLInputElement;
    await user.type(input, "sk-test-123");

    await user.click(screen.getByTestId("config-minimax-save-btn"));

    await waitFor(() => {
      expect(mSet).toHaveBeenCalledWith({ apiKey: "sk-test-123", model: "MiniMax-M2" });
    });
  });

  it("omits apiKey when nothing typed (model-only update keeps stored key)", async () => {
    const user = userEvent.setup();
    render(<ConfigMiniMax />);
    await waitFor(() => expect(mGet).toHaveBeenCalled());

    await user.click(screen.getByTestId("config-minimax-save-btn"));

    await waitFor(() => {
      expect(mSet).toHaveBeenCalledWith({ apiKey: undefined, model: "MiniMax-M2" });
    });
  });
});