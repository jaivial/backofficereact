import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TechnicalSheetRecipeTab } from "./TechnicalSheetRecipeTab";

const STEP = {
  id: 7, stepNo: 1, title: "Sofreir", description: "Sofreir la cebolla",
  imageUrl: "", generationStatus: "NONE" as const, generationMode: "", generationError: "",
};

function renderTab(overrides: Record<string, unknown> = {}) {
  const onPatchStep = vi.fn();
  render(
    <TechnicalSheetRecipeTab
      sheetId={1}
      steps={[STEP]}
      onAddStep={vi.fn()}
      onRemoveStep={vi.fn()}
      onMoveStep={vi.fn()}
      onPatchStep={onPatchStep}
      onStepsChanged={vi.fn()}
      {...overrides}
    />,
  );
  return onPatchStep;
}

describe("TechnicalSheetRecipeTab", () => {
  // The whole point of a step card is writing the method, so the text has to be
  // editable in place rather than read-only.
  it("lets the title and the description be edited", () => {
    const onPatchStep = renderTab();
    const title = screen.getByLabelText(/titulo del paso 1/i);
    fireEvent.change(title, { target: { value: "Pochar" } });
    fireEvent.blur(title);
    expect(onPatchStep).toHaveBeenCalledWith(7, { title: "Pochar" });

    const description = screen.getByLabelText(/descripcion del paso 1/i);
    fireEvent.change(description, { target: { value: "A fuego lento" } });
    fireEvent.blur(description);
    expect(onPatchStep).toHaveBeenCalledWith(7, { description: "A fuego lento" });
  });

  // Saving on every keystroke would be a request per character.
  it("does not save while the text is unchanged", () => {
    const onPatchStep = renderTab();
    fireEvent.blur(screen.getByLabelText(/titulo del paso 1/i));
    expect(onPatchStep).not.toHaveBeenCalled();
  });

  it("offers a square placeholder with an add-image action when there is no picture", () => {
    renderTab();
    expect(screen.getByRole("button", { name: /anadir imagen al paso 1/i })).toBeInTheDocument();
  });

  it("shows the picture instead of the placeholder once there is one", () => {
    renderTab({ steps: [{ ...STEP, imageUrl: "https://cdn/x.webp" }] });
    expect(screen.getByRole("img", { name: /paso 1/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /anadir imagen al paso 1/i })).not.toBeInTheDocument();
  });

  // While the provider works the user needs to see that something is happening.
  it("shows a skeleton while an image is being generated", () => {
    renderTab({ steps: [{ ...STEP, generationStatus: "RUNNING" as const }] });
    expect(screen.getByTestId("step-image-skeleton-7")).toBeInTheDocument();
  });

  it("reports a failed generation with its reason", () => {
    renderTab({
      steps: [{ ...STEP, generationStatus: "FAILED" as const, generationError: "sin credito" }],
    });
    expect(screen.getByText(/sin credito/i)).toBeInTheDocument();
  });

  it("explains the empty state instead of showing a bare list", () => {
    renderTab({ steps: [] });
    expect(screen.getByText(/aun no tiene pasos/i)).toBeInTheDocument();
  });
});
