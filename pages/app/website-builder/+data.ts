import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import type { Website, WebsitePage } from "../../../api/website-builder-types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Website Builder" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  try {
    const websiteRes = await fetch(`${backendOrigin}/api/admin/website-builder/website`, {
      headers: { cookie: cookieHeader },
    });
    const websiteJson = await websiteRes.json();

    let website: Website | null = null;
    let pages: WebsitePage[] = [];

    if (websiteJson.success && websiteJson.website) {
      website = websiteJson.website as Website;
      const websiteId = website.id;

      const pagesRes = await fetch(
        `${backendOrigin}/api/admin/website-builder/pages?website_id=${websiteId}`,
        { headers: { cookie: cookieHeader } }
      );
      const pagesJson = await pagesRes.json();
      if (pagesJson.success) {
        pages = pagesJson.pages || [];
      }
    }

    return { website, pages, error: null };
  } catch (err) {
    return { website: null, pages: [], error: err instanceof Error ? err.message : "Error cargando website" };
  }
}
