import { describe, expect, it } from "vitest";

import { splitMobileNavigation } from "./mobileNavigation";

const item = (key: string) => ({ key, href: `/app/${key}`, label: key });

describe("splitMobileNavigation", () => {
  it("keeps exactly four ordered buttons in the bar and sends the rest to overflow", () => {
    const result = splitMobileNavigation([
      item("reservas"),
      item("menus"),
      item("comida"),
      item("stock"),
      item("pos"),
      item("fichaje"),
    ] as never);

    expect(result.primary.map((entry) => entry.key)).toEqual(["reservas", "menus", "comida", "stock"]);
    expect(result.overflow.map((entry) => entry.key)).toEqual(["pos", "fichaje"]);
  });

  it("preserves the complete source order instead of depending on pinned keys", () => {
    const result = splitMobileNavigation([
      item("menus"),
      item("fichaje"),
      item("facturas"),
      item("reservas"),
      item("stock"),
    ] as never);

    expect(result.primary.map((entry) => entry.key)).toEqual(["menus", "fichaje", "facturas", "reservas"]);
    expect(result.overflow.map((entry) => entry.key)).toEqual(["stock"]);
  });
});
