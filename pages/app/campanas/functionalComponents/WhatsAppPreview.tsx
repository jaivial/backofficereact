import React from "react";
import { ArrowLeft, Check, Link2, MoreVertical, Phone, Plus, Search, Send, Smile, Video } from "lucide-react";
import { cn } from "../../../../ui/shadcn/utils";
import { CAMPAIGN_WEBSITE_COORD_ID } from "./campaignEmailChrome";
import {
  CAMPAIGN_WHATSAPP_MEDIA_COORD_ID,
  CAMPAIGN_WHATSAPP_WEBSITE_COORD_ID,
  CAMPAIGN_WHATSAPP_WEBSITE_COPY,
  toWhatsAppText,
  whatsappLeadImage,
  whatsappWebsiteHref,
} from "./campaignsApi";
import { IPHONE_DEFAULT_TIME, IPHONE_STATUSBAR_HEIGHT } from "./IPhoneFrame";

/*
 * WhatsApp chat clone for the campaign preview. The lead `https://` image of the
 * markdown becomes a media bubble and the remaining markdown, composed with
 * `toWhatsAppText` (the same string the sender delivers), is its caption: the
 * same split the backend does, so the operator proof-reads the real message
 * instead of a raw block. The website is not part of that text: like the sender,
 * it is a native URL button closing the bubble. Pure markup: no state, no
 * browser APIs, deterministic output.
 */

// WhatsApp palette, light theme, kept in one place so the whole chat matches.
export const WHATSAPP_HEADER_BG = "#075E54";
export const WHATSAPP_CHAT_BG = "#ECE5DD";
export const WHATSAPP_BUBBLE_BG = "#FFFFFF";
/** Link colour inside a bubble, overridable with the campaign accent. */
export const WHATSAPP_LINK_COLOR = "#53BDEB";

type WhatsAppPreviewProps = {
  /** Raw campaign markdown: its lead `https://` image becomes the media bubble. */
  markdown: string;
  /** Restaurant name: header contact and avatar initial. */
  brandName?: string;
  /** Restaurant logo; the avatar falls back to the brand initial without it. */
  logoUrl?: string;
  /** Website of the call-to-action button below the bubble; empty hides it. */
  websiteUrl?: string;
  /** Accent used for links; defaults to the WhatsApp blue. */
  accent?: string;
  /** Clock of the message bubble (same deterministic value as the frame). */
  time?: string;
  className?: string;
  testId?: string;
  /** Coordination id shared with the backend for cross-boundary tracing. */
  coordId?: string;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Host of `websiteUrl` without protocol/path, so a bare domain still links. */
function websiteHost(websiteUrl: string): string {
  return websiteUrl.trim().replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
}

/**
 * One regex for everything WhatsApp styles in a bubble: ```code```, links,
 * *bold*, _italic_ and the restaurant website when it carries no protocol.
 * Links come first so a URL is never eaten by the bold/italic rules.
 */
function tokenPattern(websiteUrl: string): RegExp {
  const parts = ["```[^`]+```", "https?://\\S+", "\\*[^*\n]+\\*", "_[^_\n]+_"];
  const host = websiteHost(websiteUrl);
  if (host) parts.splice(2, 0, escapeRegExp(host));
  return new RegExp(`(${parts.join("|")})`, "g");
}

/**
 * Splits `text` into plain runs and styled tokens so the bubble reads like
 * WhatsApp: formatted spans plus tappable `https://` links. Deterministic and
 * key-stable, so it renders identically on the server and the client.
 */
function renderBubbleText(text: string, websiteUrl: string, accent: string): React.ReactNode[] {
  const pattern = tokenPattern(websiteUrl);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const raw = match[0];
    const key = `wa-token-${match.index}`;
    if (raw.startsWith("```")) {
      nodes.push(
        <code key={key} className="rounded bg-black/5 px-1 py-[1px] font-mono text-[12px]" data-testid={`campaign-preview-whatsapp-code-${match.index}`}>
          {raw.slice(3, -3)}
        </code>,
      );
    } else if (raw.startsWith("*")) {
      nodes.push(
        <strong key={key} className="font-semibold" data-testid={`campaign-preview-whatsapp-bold-${match.index}`}>
          {raw.slice(1, -1)}
        </strong>,
      );
    } else if (raw.startsWith("_")) {
      nodes.push(
        <em key={key} data-testid={`campaign-preview-whatsapp-italic-${match.index}`}>
          {raw.slice(1, -1)}
        </em>,
      );
    } else {
      nodes.push(
        <a
          key={key}
          href={whatsappWebsiteHref(raw)}
          target="_blank"
          rel="noreferrer noopener"
          className="no-underline hover:underline"
          style={{ color: accent }}
          data-testid={`campaign-preview-whatsapp-link-${match.index}`}
          data-coord-id={CAMPAIGN_WEBSITE_COORD_ID}
          data-observe="campaign-preview-whatsapp-link"
        >
          {raw}
        </a>,
      );
    }
    cursor = match.index + raw.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/**
 * WhatsApp call-to-action URL button, the way the app draws one: the last strip
 * of the bubble, full-bleed edge to edge (negative margins cancel the bubble
 * padding, `rounded-b-lg` takes its bottom corners), a hairline on top and a
 * centred link-blue label with the chain icon. No surface of its own: it
 * inherits the bubble. Null without a website, the same contract
 * `toWhatsAppText` used to have with its URL line.
 */
function WebsiteButton({ websiteUrl }: { websiteUrl: string }) {
  const href = whatsappWebsiteHref(websiteUrl);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="clear-both -mx-2.5 -mb-1.5 mt-1.5 flex items-center justify-center gap-1.5 rounded-b-lg py-2 text-[13px] font-medium no-underline"
      style={{ borderTop: "1px solid rgba(0,0,0,0.08)", color: WHATSAPP_LINK_COLOR }}
      data-testid="campaign-preview-whatsapp-website-btn"
      data-coord-id={CAMPAIGN_WHATSAPP_WEBSITE_COORD_ID}
      data-observe="campaign-preview-whatsapp-website-btn"
    >
      <Link2 size={14} aria-hidden="true" data-testid="campaign-preview-whatsapp-website-btn-icon" data-observe="campaign-preview-whatsapp-website-btn-icon" />
      {CAMPAIGN_WHATSAPP_WEBSITE_COPY}
    </a>
  );
}

/** Restaurant avatar: the logo when there is one, the initial otherwise. */
function Avatar({ brandName, logoUrl }: { brandName: string; logoUrl: string }) {
  const initial = (brandName.trim()[0] || "R").toUpperCase();
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white/20 text-[14px] font-semibold text-white"
      data-testid="campaign-preview-whatsapp-avatar"
      data-observe="campaign-preview-whatsapp-avatar"
    >
      {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" data-testid="campaign-preview-whatsapp-avatar-logo" /> : initial}
    </span>
  );
}

export function WhatsAppPreview({ markdown, brandName = "", logoUrl = "", websiteUrl = "", accent = WHATSAPP_LINK_COLOR, time = IPHONE_DEFAULT_TIME, className, testId = "campaign-preview-whatsapp-screen", coordId }: WhatsAppPreviewProps) {
  const brand = brandName.trim() || "Restaurante";
  // The backend sends the first `https://` image as media and the rest as the
  // caption, so the bubble shows exactly what the customer will receive.
  const media = whatsappLeadImage(markdown);
  const text = toWhatsAppText(media?.caption ?? markdown, brandName, websiteUrl);
  return (
    <div
      className={cn("flex h-full min-h-0 flex-col", className)}
      style={{ backgroundColor: WHATSAPP_CHAT_BG }}
      data-testid={testId}
      data-coord-id={coordId}
      data-observe="campaign-preview-whatsapp"
    >
      <header
        className="flex shrink-0 items-center gap-2 px-3 pb-[6px] text-white"
        style={{ backgroundColor: WHATSAPP_HEADER_BG, paddingTop: IPHONE_STATUSBAR_HEIGHT + 6 }}
        data-testid="campaign-preview-whatsapp-header"
        data-observe="campaign-preview-whatsapp-header"
      >
        <ArrowLeft size={18} aria-hidden="true" data-testid="campaign-preview-whatsapp-back" />
        <Avatar brandName={brand} logoUrl={logoUrl} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[15px] font-semibold" data-testid="campaign-preview-whatsapp-contact">
            {brand}
          </span>
          <span className="block text-[11px] text-white/70" data-testid="campaign-preview-whatsapp-presence">
            en linea
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3" data-testid="campaign-preview-whatsapp-actions">
          <Search size={17} aria-hidden="true" data-testid="campaign-preview-whatsapp-action-search" />
          <Video size={18} aria-hidden="true" data-testid="campaign-preview-whatsapp-action-video" />
          <Phone size={16} aria-hidden="true" data-testid="campaign-preview-whatsapp-action-call" />
          <MoreVertical size={17} aria-hidden="true" data-testid="campaign-preview-whatsapp-action-menu" />
        </span>
      </header>

      <div
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-3 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        data-testid="campaign-preview-whatsapp-chat"
        data-observe="campaign-preview-whatsapp-chat"
      >
        <span className="mx-auto rounded-md bg-white/70 px-2 py-[2px] text-[10px] uppercase tracking-wide text-neutral-500" data-testid="campaign-preview-whatsapp-date">
          hoy
        </span>
        <p className="mx-auto rounded-md bg-[#FCF4CB] px-2 py-[3px] text-center text-[10px] leading-snug text-neutral-500" data-testid="campaign-preview-whatsapp-notice">
          Los mensajes se cifran de extremo a extremo. Nadie fuera de este chat puede leerlos.
        </p>
        <div
          className="relative ml-2 mt-1 max-w-[88%] self-start rounded-lg px-2.5 py-1.5 text-[13px] leading-snug text-neutral-800 shadow-sm"
          style={{ backgroundColor: WHATSAPP_BUBBLE_BG }}
          data-testid="campaign-preview-whatsapp-bubble"
          data-observe="campaign-preview-whatsapp-bubble"
        >
          {media && (
            <figure
              className="m-0 -mx-2.5 -mt-1.5 mb-1.5 overflow-hidden rounded-t-lg"
              data-testid="campaign-preview-whatsapp-media"
              data-coord-id={CAMPAIGN_WHATSAPP_MEDIA_COORD_ID}
              data-observe="campaign-preview-whatsapp-media"
            >
              <img
                src={media.src}
                alt={media.alt}
                className="block aspect-[4/3] w-full bg-black/5 object-cover"
                data-testid="campaign-preview-whatsapp-media-image"
                data-observe="campaign-preview-whatsapp-media-image"
              />
            </figure>
          )}
          <span
            aria-hidden="true"
            className="absolute -left-[7px] top-0 h-0 w-0 border-r-[8px] border-t-[10px]"
            style={{ borderRightColor: "transparent", borderTopColor: WHATSAPP_BUBBLE_BG }}
            data-testid="campaign-preview-whatsapp-tail"
          />
          <span className="float-right ml-2 mt-[6px] flex items-center gap-[3px] text-[10px] text-neutral-400" data-testid="campaign-preview-whatsapp-meta">
            <span data-testid="campaign-preview-whatsapp-time">{time}</span>
            <Check size={12} aria-hidden="true" data-testid="campaign-preview-whatsapp-check" />
          </span>
          <span className="whitespace-pre-wrap" data-testid="campaign-preview-whatsapp">
            {renderBubbleText(text, websiteUrl, accent)}
          </span>
          <WebsiteButton websiteUrl={websiteUrl} />
        </div>
      </div>

      <div
        className="flex shrink-0 items-center gap-2 px-2 pb-2 pt-1"
        style={{ backgroundColor: WHATSAPP_CHAT_BG }}
        data-testid="campaign-preview-whatsapp-input-bar"
        data-observe="campaign-preview-whatsapp-input-bar"
      >
        <Smile size={22} className="shrink-0 text-neutral-500" aria-hidden="true" data-testid="campaign-preview-whatsapp-emoji" />
        <span
          className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-white px-3 py-[6px] text-[13px] text-neutral-400"
          data-testid="campaign-preview-whatsapp-input"
        >
          Mensaje
          <Plus size={18} className="ml-auto shrink-0 text-neutral-500" aria-hidden="true" data-testid="campaign-preview-whatsapp-attach" />
        </span>
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
          style={{ backgroundColor: WHATSAPP_HEADER_BG }}
          data-testid="campaign-preview-whatsapp-send"
          data-observe="campaign-preview-whatsapp-send"
        >
          <Send size={16} aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
