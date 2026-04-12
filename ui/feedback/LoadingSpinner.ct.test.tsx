/**
 * Component test for LoadingSpinner.
 * Uses vitest + @testing-library/react (jsdom environment).
 * Run with: bun test ui/feedback/LoadingSpinner.ct.test.tsx
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { LoadingSpinner } from "./LoadingSpinner";

describe("LoadingSpinner", () => {
  it("renders centered spinner with status role", () => {
    render(<LoadingSpinner centered size="sm" />);

    const spinner = screen.getByRole("status");
    expect(spinner).toBeVisible();
    expect(spinner).toHaveClass("bo-spinnerCentered");
  });

  it("renders with all size variants", () => {
    const sizes = ["sm", "md", "lg", "xl"] as const;
    for (const size of sizes) {
      const { container } = render(<LoadingSpinner size={size} />);
      const spinner = container.querySelector(".bo-spinner");
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveClass(`bo-spinner--${size}`);
    }
  });

  it("shows label text when provided", () => {
    render(<LoadingSpinner label="Cargando..." />);
    expect(screen.getByText("Cargando...")).toBeVisible();
  });

  it("renders with centered class when centered prop is true", () => {
    const { container } = render(<LoadingSpinner centered />);
    const wrapper = container.querySelector(".bo-spinnerCentered");
    expect(wrapper).toBeInTheDocument();
  });
});
