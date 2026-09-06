import { createClient } from "../../../../api/client";
import type { Campaign, CampaignChannel, CampaignInput, CampaignTheme } from "../../../../api/types";

// Single access point to the campaign endpoints so pages stay presentational.
export type CampaignsAPI = ReturnType<typeof createCampaignsAPI>;

export function createCampaignsAPI() {
  const config = createClient({ baseUrl: "" }).config;
  return {
    list: config.listCampaigns.bind(config),
    get: config.getCampaign.bind(config),
    create: config.createCampaign.bind(config),
    update: config.updateCampaign.bind(config),
    remove: config.deleteCampaign.bind(config),
    preview: config.previewCampaign.bind(config),
    uploadImage: config.uploadCampaignImage.bind(config),
    audience: config.campaignAudience.bind(config),
    test: config.testCampaign.bind(config),
    send: config.sendCampaign.bind(config),
    status: config.campaignStatus.bind(config),
    recipients: config.campaignRecipients.bind(config),
  };
}

export const CAMPAIGN_RATE_LIMITS = {
  email: { min: 1, max: 600, fallback: 60 },
  whatsapp: { min: 1, max: 120, fallback: 12 },
} as const;

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

export const DEFAULT_CAMPAIGN_THEME: CampaignTheme = {
  background: "#f5f5f4",
  surface: "#ffffff",
  text: "#1c1917",
  accent: "#b45309",
  fontFamily: "Helvetica, Arial, sans-serif",
  maxWidth: 600,
  align: "left",
};

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
    email_per_minute: campaign.email_per_minute || 60,
    whatsapp_per_minute: campaign.whatsapp_per_minute || 12,
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
    email_per_minute: 60,
    whatsapp_per_minute: 12,
  };
}

export function apiMessage(result: unknown, fallback: string): string {
  if (result && typeof result === "object" && "message" in result) {
    const message = (result as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
