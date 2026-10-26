import { describe, expect, it } from "vitest";
import { createClient } from "./client";

describe("menu public SEO client", () => {
  it("patches all bilingual fields for the active menu", async () => {
    let requestedURL = "";
    let requestedBody = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      requestedURL = String(input);
      requestedBody = String(init?.body || "");
      return new Response(JSON.stringify({ success: true, seo_slug: "menu-arrocero" }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    };
    const client = createClient({ baseUrl: "http://127.0.0.1:8080", fetchImpl });
    const fields = {
      seo_slug: "menu-arrocero", seo_title: "Title", seo_title_english: "English title",
      seo_description: "Description", seo_description_english: "English description",
      seo_h1: "H1", seo_h1_english: "English H1",
    };
    const result = await client.menus.gruposV2.patchSEO(42, fields);
    expect(requestedURL).toBe("http://127.0.0.1:8080/api/admin/group-menus-v2/42/seo");
    expect(JSON.parse(requestedBody)).toEqual(fields);
    if (!result.success) throw new Error(result.message);
    expect(result.seo_slug).toBe("menu-arrocero");
  });
});
