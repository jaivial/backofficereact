import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Page from "./+Page";
import { expectAllElementsHaveDataAttr } from "../../../lib/test/assertDataAttrs";

describe("Comida hub page data-* attributes", () => {
  it("all rendered HTML elements have a semantic data-* attribute", () => {
    const { container } = render(<Page />);
    expectAllElementsHaveDataAttr(container);
  });

  it("renders category cards as native links", () => {
    const { getByRole } = render(<Page />);

    expect(getByRole("link", { name: "Abrir Platos" }).getAttribute("href")).toBe("/app/comida/platos");
    expect(getByRole("link", { name: "Abrir Bebidas" }).getAttribute("href")).toBe("/app/comida/bebidas");
    expect(getByRole("link", { name: "Abrir Cafes" }).getAttribute("href")).toBe("/app/comida/cafes");
    expect(getByRole("link", { name: "Abrir Vinos" }).getAttribute("href")).toBe("/app/comida/vinos");
  });
});
