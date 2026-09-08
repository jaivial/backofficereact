// The email shell is served by the backend (`campaignEmailShell` in
// campaign_markdown.go) so the preview matches the delivered email. That shell
// already carries the booking-confirmation footer (<hr> + automatic-message +
// copyright), but it only emits the accent header band when a logo URL is
// configured. This module guarantees the band is always there so both the
// preview and (once the Go change ships) the real email keep the booking
// confirmation chrome.

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

/**
 * Returns `shell` with the booking confirmation header and footer guaranteed.
 * Anything the backend already provides is left untouched, so the preview stays
 * byte-for-byte identical to the sent email whenever the shell is complete.
 */
export function ensureCampaignEmailChrome(shell: string, brandName: string, logoUrl: string, accent: string): string {
  if (!shell) return shell;
  let out = shell;
  if (!HEADER_BAND_RE.test(out)) {
    // The band goes as the first row of the 600px card table.
    out = out.replace(/(<table\b[^>]*>\s*)/i, (match) => `${match}${campaignEmailHeaderRow(brandName, logoUrl, accent)}`);
  }
  if (!FOOTER_RE.test(out)) {
    out = out.replace(/(<\/td>\s*<\/tr>\s*<\/table>)/i, (match) => `${campaignEmailFooterHTML(brandName)}\n${match}`);
  }
  return out;
}
