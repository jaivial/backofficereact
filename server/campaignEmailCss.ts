import { createHash } from "node:crypto";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

/**
 * Tailwind compiler of the campaign HTML builder (coordination id
 * campaign_html_builder_v1). The builder designs emails with Tailwind classes;
 * this turns exactly the classes of one design into plain CSS that the browser
 * then inlines into the email. Default Tailwind theme on purpose: the email is
 * the restaurant's brand, not the backoffice one, and preflight stays off
 * because email clients bring their own defaults.
 */
export const CAMPAIGN_EMAIL_CSS_PATH = "/bo-tools/campaign-email-css";
export const CAMPAIGN_EMAIL_CSS_MAX_BYTES = 512 * 1024;

const SOURCE_PATH = "campaign-email-builder.css";

export async function compileCampaignEmailCss(html: string): Promise<string> {
  // Tailwind v3 reuses its context while the input CSS of a source path does
  // not change, and that context still holds the previous raw content. The
  // digest of the design in the input forces a fresh context for every new
  // design and lets Tailwind dispose the previous one (same source path).
  const digest = createHash("sha1").update(html).digest("hex");
  const result = await postcss([
    tailwindcss({
      content: [{ raw: html, extension: "html" }],
      corePlugins: { preflight: false },
      theme: {},
    }),
  ]).process(`@tailwind utilities;\n/* ${digest} */`, { from: SOURCE_PATH });
  return result.css;
}
