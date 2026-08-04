import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MenuDishPreviewCard } from "./MenuDishPreviewCard";

describe("MenuDishPreviewCard allergens", () => {
  it("renders allergen icons through the shared list", () => {
    render(<MenuDishPreviewCard title="Lasagna" allergens={["Gluten", "Leche"]} />);
    const list = screen.getByRole("list", { name: "Alergenos" });
    expect(list).toHaveClass("bo-menuDishPreviewAllergens");
    expect(screen.getByRole("img", { name: /Gluten/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Leche/ })).toBeInTheDocument();
  });

  it("normalizes legacy aliases that the old inline map rejected", () => {
    render(<MenuDishPreviewCard title="Tarta" allergens={["lacteos"]} />);
    expect(screen.getByRole("img", { name: /Leche/ })).toBeInTheDocument();
  });

  it("omits the allergen list entirely when there are none", () => {
    render(<MenuDishPreviewCard title="Ensalada" allergens={[]} />);
    expect(screen.queryByRole("list", { name: "Alergenos" })).not.toBeInTheDocument();
  });

  it("still renders the dish title and description", () => {
    render(<MenuDishPreviewCard title="Lasagna" description="Con bechamel" allergens={["Gluten"]} />);
    expect(screen.getByRole("heading", { name: "Lasagna" })).toBeInTheDocument();
    expect(screen.getByText("Con bechamel")).toBeInTheDocument();
  });
});
