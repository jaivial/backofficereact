import { createClient } from "../../../../api/client";
import { CAMPAIGN_WEBSITE_COPY } from "./campaignEmailChrome";
import { markdownImages } from "../../../../lib/richText/markdownHtml";
import type { APISuccess, APIError, Campaign, CampaignChannel, CampaignInput, CampaignTheme } from "../../../../api/types";

// Single access point to the campaign endpoints so pages stay presentational.
export type CampaignsAPI = ReturnType<typeof createCampaignsAPI>;

/** Payload of `/api/admin/campanas/template`: shell plus reference restaurant branding. */
export type CampaignTemplatePayload = {
  theme: CampaignTheme;
  brand_name: string;
  logo_url: string;
  /** Public website of the restaurant; empty when it has none (button omitted). */
  website: string;
  shell: string;
  body_placeholder: string;
};

export function createCampaignsAPI() {
  const config = createClient({ baseUrl: "" }).config;
  return {
    list: config.listCampaigns.bind(config),
    get: config.getCampaign.bind(config),
    create: config.createCampaign.bind(config),
    update: config.updateCampaign.bind(config),
    remove: config.deleteCampaign.bind(config),
    preview: config.previewCampaign.bind(config),
    // The payload type is declared here so the preview can read `website` even
    // before api/client.ts learns about the backend key.
    template: (theme?: Partial<CampaignTheme>): Promise<APISuccess<CampaignTemplatePayload> | APIError> =>
      config.campaignTemplate(theme) as Promise<APISuccess<CampaignTemplatePayload> | APIError>,
    uploadImage: config.uploadCampaignImage.bind(config),
    audience: config.campaignAudience.bind(config),
    test: config.testCampaign.bind(config),
    send: config.sendCampaign.bind(config),
    status: config.campaignStatus.bind(config),
    recipients: config.campaignRecipients.bind(config),
  };
}

// Provider ceilings, identical to the backend clamp: 5 emails per minute is the
// 300/hour Titan quota, 1 WhatsApp per minute is the only safe step above the
// real 12/hour cap (the sender itself waits 300s between messages).
export const CAMPAIGN_RATE_LIMITS = {
  email: { min: 1, max: 5, fallback: 5 },
  whatsapp: { min: 1, max: 1, fallback: 1 },
} as const;

/** Seconds each provider really waits between two sends (12s email, 300s WhatsApp). */
export const CAMPAIGN_CHANNEL_PAUSE = { email: 12, whatsapp: 300 } as const;

/** Quota copy so the operator sees the hard ceiling instead of discovering it. */
export const CAMPAIGN_RATE_NOTES = {
  email: "max 300 por hora (Titan) y 1000 por dia",
  whatsapp: "max 12 por hora y 300 por dia",
} as const;

type RateLimits = { min: number; max: number; fallback: number };

/** Brings a stored rate back inside the safe provider window (old campaigns can be higher). */
export function clampRate(value: number | undefined, limits: RateLimits): number {
  const rate = Math.trunc(Number(value ?? 0));
  if (!Number.isFinite(rate) || rate < limits.min) return limits.fallback;
  return Math.min(limits.max, rate);
}

/** Derives the hour/day throughput an operator is choosing with a per-minute rate. */
export function ratePlan(perMinute: number) {
  const safe = Number.isFinite(perMinute) && perMinute > 0 ? perMinute : 1;
  return { perMinute: safe, perHour: safe * 60, perDay: safe * 60 * 24 };
}

/** Estimated minutes to drain a queue of `count` messages at `perMinute`. */
export function estimatedMinutes(count: number, perMinute: number): number {
  const plan = ratePlan(perMinute);
  return Math.ceil(count / plan.perMinute);
}

/**
 * Human estimate to drain `count` messages honouring the provider spacing: the
 * per-minute rate sets the floor, the provider pause can only make it slower
 * (WhatsApp sends one every 5 min, so "1 por minuto" would be a lie).
 */
export function estimatedTime(count: number, perMinute: number, pauseSeconds: number): string {
  const plan = ratePlan(perMinute);
  const spacing = Math.max(60 / plan.perMinute, pauseSeconds);
  const minutes = Math.ceil((Math.max(0, count) * spacing) / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.ceil(minutes / 60)} h`;
}

// Mirrors the transactional email template of the reference restaurant so the
// preview starts on the look customers already receive.
export const DEFAULT_CAMPAIGN_THEME: CampaignTheme = {
  background: "#f4f4f4",
  surface: "#ffffff",
  text: "#333333",
  accent: "#097969",
  fontFamily: "Arial, Helvetica, sans-serif",
  maxWidth: 600,
  align: "left",
};

/** Coordination id of the WhatsApp lead media, shared with the sender. */
export const CAMPAIGN_WHATSAPP_MEDIA_COORD_ID = "camp-wa-media";

/** Coordination id of the WhatsApp website button, shared with the sender. */
export const CAMPAIGN_WHATSAPP_WEBSITE_COORD_ID = "camp-wa-website";

/** Copy of the WhatsApp call to action, the same wording the email uses. */
export const CAMPAIGN_WHATSAPP_WEBSITE_COPY = CAMPAIGN_WEBSITE_COPY;

/**
 * Absolute `https://` target for a website the sender accepts bare
 * (`villacarmen.com`), the same normalisation a bubble applies to a link.
 * Empty when there is no website, so callers just skip the button.
 */
export function whatsappWebsiteHref(websiteUrl: string): string {
  const url = websiteUrl.trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// One markdown image token, the exact shape `markdownImages` parses
// (`![alt](URL =W)`); it only locates the token so it can be dropped.
const MARKDOWN_IMAGE_TOKEN_RE = /!\[[^\]]*\]\([^)\s]+(?:\s+[^\s)]+)?\)/g;

/**
 * Lead media of a WhatsApp message, mirroring `splitCampaignLeadImage`
 * (`internal/api/campaign_markdown.go`): the FIRST `https://` markdown image
 * becomes the media and the markdown without it is the caption. Images without
 * an `https://` URL and any extra one stay in the caption as their URL, the same
 * degradation the backend applies. Null when there is nothing to attach.
 */
export function whatsappLeadImage(markdown: string): { src: string; alt: string; caption: string } | null {
  const lead = markdownImages(markdown).find((image) => image.src.toLowerCase().startsWith("https://"));
  if (!lead) return null;
  let dropped = false;
  const caption = (markdown || "").replace(MARKDOWN_IMAGE_TOKEN_RE, (token) => {
    if (dropped || markdownImages(token)[0]?.src !== lead.src) return token;
    dropped = true;
    return "";
  });
  return { src: lead.src, alt: lead.alt, caption };
}

/**
 * Client-side twin of the backend WhatsApp renderer, used for live preview.
 * `brandName` becomes the bold first line the email shows in its accent band,
 * exactly what the sender delivers: brand header + body (+ opt-out link). The
 * website is NOT part of the text any more, the backend ships it as a native
 * WhatsApp URL button, so `websiteUrl` is kept only for call compatibility and
 * ignored here; anything missing is simply omitted.
 */
export function toWhatsAppText(markdown: string, brandName = "", websiteUrl = ""): string {
  const body = markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((raw) => {
      let line = raw.trim();
      if (line === "---") return "———";
      line = line.replace(/!\[[^\]]*\]\(([^)\s]+)\)/g, "$1");
      line = line.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1: $2");
      line = line.replace(/^>\s/, "");
      line = line.replace(/^#{1,3}\s+(.*)$/, "*$1*");
      line = line.replace(/^\*\s/, "- ");
      line = line.replace(/\*\*([^*]+)\*\*/g, "*$1*");
      line = line.replace(/(^|[^*])\*([^*]+)\*/g, "$1_$2_");
      return line.replace(/`([^`]+)`/g, "```$1```");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const brand = brandName.trim();
  const header = brand ? `*${brand}*\n\n` : "";
  return `${header}${body}`;
}

export const CAMPAIGN_CHANNELS: { key: CampaignChannel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
];

export function campaignToInput(campaign: Campaign): CampaignInput {
  return {
    name: campaign.name,
    subject: campaign.subject,
    body_markdown: campaign.body_markdown,
    theme: campaign.theme ?? DEFAULT_CAMPAIGN_THEME,
    channels: campaign.channels?.length ? campaign.channels : ["email"],
    audience: campaign.audience ?? "bookings",
    audience_days: campaign.audience_days || 365,
    manual_recipients: campaign.manual_recipients ?? [],
    email_per_minute: clampRate(campaign.email_per_minute, CAMPAIGN_RATE_LIMITS.email),
    whatsapp_per_minute: clampRate(campaign.whatsapp_per_minute, CAMPAIGN_RATE_LIMITS.whatsapp),
  };
}

export function emptyCampaignInput(): CampaignInput {
  return {
    name: "",
    subject: "",
    body_markdown: "# Hola\n\nEscribe aqui tu anuncio.\n",
    theme: { ...DEFAULT_CAMPAIGN_THEME },
    channels: ["email"],
    audience: "bookings",
    audience_days: 365,
    manual_recipients: [],
    email_per_minute: CAMPAIGN_RATE_LIMITS.email.max,
    whatsapp_per_minute: CAMPAIGN_RATE_LIMITS.whatsapp.max,
  };
}

export function apiMessage(result: unknown, fallback: string): string {
  if (result && typeof result === "object" && "message" in result) {
    const message = (result as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
