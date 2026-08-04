import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StepImagePopover } from "./StepImagePopover";

vi.mock("../../../../../lib/imageCompressor", () => ({
  compressImageToWebP: vi.fn(async () => "data:image/webp;base64,AAAA"),
  isValidImageFile: () => true,
  formatFileSize: () => "12 KB",
}));

function mockFetch() {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ success: true, jobId: 5, imageUrl: "https://cdn/x.webp" }),
  })) as unknown as typeof fetch;
}

function renderPopover(props: Partial<React.ComponentProps<typeof StepImagePopover>> = {}) {
  const anchor = { current: document.createElement("button") };
  document.body.appendChild(anchor.current);
  const onQueued = vi.fn();
  render(
    <StepImagePopover
      open
      anchorRef={anchor}
      sheetId={1}
      step={{
        id: 7, stepNo: 1, title: "Sofreir", description: "Sofreir la cebolla",
        imageUrl: "", generationStatus: "NONE", generationMode: "", generationError: "",
      }}
      onClose={() => {}}
      onQueued={onQueued}
      {...props}
    />,
  );
  return onQueued;
}

describe("StepImagePopover", () => {
  beforeEach(() => mockFetch());

  it("offers both ways to get an image", () => {
    renderPopover();
    expect(screen.getByRole("button", { name: /subir imagen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generar con ia/i })).toBeInTheDocument();
  });

  // The prompt is built from the step the user already wrote, so they do not
  // have to describe the same thing twice.
  it("generates from the step title and description", async () => {
    const onQueued = renderPopover();
    fireEvent.click(screen.getByRole("button", { name: /generar con ia/i }));
    await waitFor(() => expect(onQueued).toHaveBeenCalled());

    const call = (global.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls.at(-1)!;
    expect(String(call[0])).toContain("/image-jobs");
    const body = JSON.parse(call[1].body as string);
    expect(body.mode).toBe("AI_GENERATE");
    expect(body.prompt).toContain("Sofreir la cebolla");
  });

  // A step with no text cannot describe an image, so generation must be refused
  // rather than sending an empty prompt to the provider.
  it("cannot generate when the step has no text to describe", () => {
    renderPopover({
      step: {
        id: 7, stepNo: 1, title: "", description: "", imageUrl: "",
        generationStatus: "NONE", generationMode: "", generationError: "",
      },
    });
    expect(screen.getByRole("button", { name: /generar con ia/i })).toBeDisabled();
  });

  it("asks whether to enhance an uploaded photo before sending it", async () => {
    renderPopover();
    const file = new File(["x"], "a.png", { type: "image/png" });
    const input = screen.getByLabelText(/archivo de imagen/i);
    fireEvent.change(input, { target: { files: [file] } });

    // The AI advisor step mirrors the dish image flow.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continuar sin mejorar/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /mejorar con ia/i })).toBeInTheDocument();
  });
});
