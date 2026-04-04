import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Page from "./+Page";
import { expectAllElementsHaveDataAttr } from "../../../lib/test/assertDataAttrs";

describe("Comida hub page data-* attributes", () => {
  it("all rendered HTML elements have a semantic data-* attribute", () => {
    const { container } = render(<Page />);
    expectAllElementsHaveDataAttr(container);
  });
});
