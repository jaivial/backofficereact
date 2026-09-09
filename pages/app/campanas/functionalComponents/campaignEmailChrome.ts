// The email shell is served by the backend (`campaignEmailShell` in
// campaign_markdown.go) so the preview matches the delivered email. That shell
// already carries the booking-confirmation footer (<hr> + automatic-message +
// copyright), but it only emits the accent header band when a logo URL is
// configured. This module guarantees the band, the restaurant website button
// and the footer are always there so both the preview and (once the Go change
// ships) the real email keep the booking confirmation chrome.

/** Accent of the booking confirmation template, used when no theme accent applies. */
export const BOOKING_HEADER_ACCENT = "#097969";

function escapeHTML(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Header band of the booking confirmation email: accent strip plus logo. */
export function campaignEmailHeaderRow(brandName: string, logoUrl: string, accent: string): string {
  const band = accent || BOOKING_HEADER_ACCENT;
  const brand = escapeHTML(brandName || "Restaurante");
  const content = logoUrl
    ? `<img src="${escapeHTML(logoUrl)}" alt="${brand}" style="max-width:200px;height:auto;">`
    : `<span style="color:#ffffff;font-size:22px;font-weight:bold;">${brand}</span>`;
  return `<tr>\n<td style="padding:30px 20px;text-align:center;background-color:${band};">\n${content}\n</td>\n</tr>\n`;
}

/** Footer of the booking confirmation email: rule plus automatic-message notice. */
export function campaignEmailFooterHTML(brandName: string): string {
  return `<hr style="border:none;border-top:1px solid #eee;margin:30px 0;">\n<p style="font-size:12px;color:#666;text-align:center;">Este es un email automatico, por favor no responda a este mensaje.<br>&copy; ${escapeHTML(
    brandName || "Restaurante",
  )}. Todos los derechos reservados.</p>`;
}

const HEADER_BAND_RE = /<td[^>]*text-align:center;background-color:/i;
const FOOTER_RE = /Este es un email autom[aá]tico/i;
// Footer rule the chrome itself renders, so the website button lands just above it.
const FOOTER_RULE_RE = /<hr\b[^>]*border-top:1px solid #eee[^>]*>/i;
// The backend marks its own button with this same test id, which keeps the
// injection below idempotent: a shell that already carries it is left untouched.
const WEBSITE_BUTTON_RE = /data-testid="campaign-email-website-btn"/i;

/** Copy of the website call to action, shared verbatim with the backend shell. */
export const CAMPAIGN_WEBSITE_COPY = "Visita nuestra web";

/** Coordination id of the website button, shared with the backend shell. */
export const CAMPAIGN_WEBSITE_COORD_ID = "camp-web";

/**
 * Centred accent button pointing at the restaurant website. Like the footer it is
 * plain inline-styled markup (email clients ignore <style> blocks) and it comes
 * back empty without a URL, so callers just skip the element altogether.
 */
export function campaignEmailWebsiteButtonHTML(websiteUrl: string, accent: string): string {
  const url = websiteUrl.trim();
  if (!url) return "";
  return `<p style="margin:24px 0 0;text-align:center;">\n<a href="${escapeHTML(url)}" data-testid="campaign-email-website-btn" data-coord-id="${CAMPAIGN_WEBSITE_COORD_ID}" data-observe="campaign-email-website-btn" style="display:inline-block;padding:12px 24px;border-radius:8px;background-color:${
    accent || BOOKING_HEADER_ACCENT
  };color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">${CAMPAIGN_WEBSITE_COPY}</a>\n</p>\n`;
}

/**
 * Returns `shell` with the booking confirmation header, website button and
 * footer guaranteed, so a shell that predates the backend change still previews
 * the whole email. Anything the backend already provides is left untouched, which
 * keeps the preview byte-for-byte identical to the sent email whenever the shell
 * is complete (and makes this function idempotent).
 */
export function ensureCampaignEmailChrome(shell: string, brandName: string, logoUrl: string, accent: string, websiteUrl = ""): string {
  if (!shell) return shell;
  let out = shell;
  if (!HEADER_BAND_RE.test(out)) {
    // The band goes as the first row of the 600px card table.
    out = out.replace(/(<table\b[^>]*>\s*)/i, (match) => `${match}${campaignEmailHeaderRow(brandName, logoUrl, accent)}`);
  }
  if (!FOOTER_RE.test(out)) {
    out = out.replace(/(<\/td>\s*<\/tr>\s*<\/table>)/i, (match) => `${campaignEmailFooterHTML(brandName)}\n${match}`);
  }
  const button = campaignEmailWebsiteButtonHTML(websiteUrl, accent);
  // The button sits below the message, just above the footer rule; the footer is
  // guaranteed above, so that rule always exists from here on.
  if (button && !WEBSITE_BUTTON_RE.test(out)) {
    out = out.replace(FOOTER_RULE_RE, (rule) => `${button}${rule}`);
  }
  return out;
}
