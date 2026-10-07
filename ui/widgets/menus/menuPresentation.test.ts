import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => {
  const Icon = () => React.createElement("span", { "data-testid": "menu-type-icon" });
  return { Lock: Icon, Star: Icon, Users: Icon, UsersRound: Icon, UtensilsCrossed: Icon };
});

import { menuTypeFromQuerySlug, menuTypeFullLabel, menuTypeQuerySlug } from "./menuPresentation";
import { MENU_TYPE } from "./menuTypeCodes";

describe("menu type URL presentation", () => {
  it("serializes the conventional closed menu type for the menus URL", () => {
    expect(menuTypeQuerySlug(MENU_TYPE.CLOSED_CONVENTIONAL)).toBe("menucerradoconvencional");
  });

  it("restores a menu type from its URL slug", () => {
    expect(menuTypeFromQuerySlug("menucerradoconvencional")).toBe(MENU_TYPE.CLOSED_CONVENTIONAL);
    expect(menuTypeFromQuerySlug("unknown")).toBeNull();
  });

  it("returns the full menu type label for editor breadcrumbs", () => {
    expect(menuTypeFullLabel(MENU_TYPE.CLOSED_CONVENTIONAL)).toBe("Menu cerrado convencional");
  });
});
