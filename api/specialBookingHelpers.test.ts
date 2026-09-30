import { describe, expect, it } from "vitest";

import { principalesPending, type DraftSpecialMenu } from "./specialBookingHelpers";

const menu = (over: Partial<DraftSpecialMenu> = {}): DraftSpecialMenu => ({
  special_date_menu_id: 7,
  menu_id: 3,
  is_custom: false,
  label: "Menú especial",
  unit_price: 40,
  count: 3,
  adelanto_per_unit: 10,
  adelanto_payment_method: null,
  items: [],
  ...over,
});

describe("principalesPending", () => {
  it("counts the counters of a menu that still have no dish", () => {
    expect(principalesPending(menu({ count: 3, items: [] }))).toBe(3);
    expect(principalesPending(menu({ count: 3, items: [{ dish_id: 1, name: "Arroz" }] }))).toBe(2);
    expect(principalesPending(menu({ count: 3, items: [{ dish_id: 1, name: "Arroz" }, { dish_id: 2, name: "" }] }))).toBe(2);
  });

  it("is zero once every counter has a dish, and never negative", () => {
    expect(principalesPending(menu({ count: 2, items: [{ dish_id: 1, name: "A" }, { dish_id: 2, name: "B" }] }))).toBe(0);
    expect(principalesPending(menu({ count: 1, items: [{ dish_id: 1, name: "A" }, { dish_id: 2, name: "B" }] }))).toBe(0);
    expect(principalesPending(menu({ count: 0 }))).toBe(0);
  });

  it("never blocks a custom menu, which has no principals to pick", () => {
    expect(principalesPending(menu({ is_custom: true, count: 4, items: [] }))).toBe(0);
  });
});
