import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => {
  const Icon = () => React.createElement("span", { "data-testid": "menu-type-icon" });
  return { Lock: Icon, Star: Icon, Users: Icon, UsersRound: Icon, UtensilsCrossed: Icon };
});

import { menuTypeFromQuerySlug, menuTypeFullLabel, menuTypeQuerySlug } from "./menuPresentation";

describe("menu type URL presentation", () => {
  it("serializes the conventional closed menu type for the menus URL", () => {
    expect(menuTypeQuerySlug("closed_conventional")).toBe("menucerradoconvencional");
  });

  it("restores a menu type from its URL slug", () => {
    expect(menuTypeFromQuerySlug("menucerradoconvencional")).toBe("closed_conventional");
    expect(menuTypeFromQuerySlug("unknown")).toBeNull();
  });

  it("returns the full menu type label for editor breadcrumbs", () => {
    expect(menuTypeFullLabel("closed_conventional")).toBe("Menu cerrado convencional");
  });
});
