import { describe, expect, it } from "vitest";
import { addContentItem, buildCTAURL, createDraftAd, removeContentItem, reorderContent, WEBSITE_ROUTE_OPTIONS } from "./adEditor";

describe("adEditor", () => {
  it("limits each text type to five and image to one", () => {
    let ad = createDraftAd();
    for (let i = 0; i < 5; i += 1) ad = addContentItem(ad, "title");
    expect(() => addContentItem(ad, "title")).toThrow(/5/);
    ad = addContentItem(ad, "image");
    expect(() => addContentItem(ad, "image")).toThrow(/imagen/i);
  });

  it("removes rows completely instead of storing empty placeholders", () => {
    let ad = addContentItem(createDraftAd(), "subtitle");
    const id = ad.content[0]?.id;
    ad = removeContentItem(ad, id || "");
    expect(ad.content).toEqual([]);
  });

  it("persists the exact drag order", () => {
    let ad = createDraftAd();
    ad = addContentItem(addContentItem(addContentItem(ad, "title"), "text"), "subtitle");
    const ids = ad.content.map((item) => item.id);
    const next = reorderContent(ad, [ids[2], ids[0], ids[1]]);
    expect(next.content.map((item) => item.id)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("builds route CTA URLs from the saved restaurant website", () => {
    expect(buildCTAURL("https://villa.test/", { navigation_mode: "route", route: "/reservas", custom_url: "" })).toBe("https://villa.test/reservas");
    const routes = WEBSITE_ROUTE_OPTIONS.map((x) => x.value);
    expect(routes).toContain("/menusdegrupos");
    expect(routes).toEqual(expect.arrayContaining(["/menufindesemana", "/menudeldia", "/reservas.php", "/avisolegal.html", "/booking_policies.php", "/confirm", "/cancel", "/update-rice", "/protecciondatos.html"]));
    expect(buildCTAURL("https://villa.test", { navigation_mode: "custom", route: "", custom_url: "javascript:alert(1)" })).toBe("");
  });
});
