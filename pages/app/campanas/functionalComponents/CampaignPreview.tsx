import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CampaignTheme } from "../../../../api/types";
import { toWhatsAppText } from "./campaignsApi";
import { renderCampaignEmailBody } from "./campaignEmailBody";
import { ensureCampaignEmailChrome } from "./campaignEmailChrome";
import { IPhoneFrame, IPHONE_DEFAULT_TIME } from "./IPhoneFrame";
import { WhatsAppPreview } from "./WhatsAppPreview";

// Live preview: the markdown body is rendered in the browser on every keystroke
// and injected into the email shell served by the backend, so what you see is
// the exact document that gets delivered. The booking confirmation header and
// footer are guaranteed on top of the shell.

type CampaignPreviewProps = {
  markdown: string;
  theme: CampaignTheme;
  shell: string;
  bodyPlaceholder: string;
  device: "mobile" | "desktop";
  brandName?: string;
  logoUrl?: string;
  /** Public website of the restaurant; empty means no website button at all. */
  websiteUrl?: string;
  /** Coordination id shared with the backend for cross-boundary tracing. */
  coordId?: string;
};

const MIN_PREVIEW_HEIGHT = 240;

export function CampaignPreview({ markdown, theme, shell, bodyPlaceholder, device, brandName = "", logoUrl = "", websiteUrl = "", coordId }: CampaignPreviewProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(MIN_PREVIEW_HEIGHT);

  const html = useMemo(() => {
    if (!shell || !bodyPlaceholder) return "";
    const withChrome = ensureCampaignEmailChrome(shell, brandName, logoUrl, theme.accent, websiteUrl);
    return withChrome.replace(bodyPlaceholder, renderCampaignEmailBody(markdown, theme));
  }, [shell, bodyPlaceholder, markdown, theme, brandName, logoUrl, websiteUrl]);

  // The iframe has no intrinsic height, so the email is measured inside it and
  // the element grows to fit: no fixed height, no inner scrollbar.
  const measure = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const next = Math.max(doc.body.scrollHeight, doc.documentElement?.scrollHeight ?? 0, MIN_PREVIEW_HEIGHT);
    setHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  }, []);

  // Re-measures on load and on any later reflow (images finishing, width
  // changes from the mobile/desktop toggle, responsive breakpoints).
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    measure();
    // The observer must come from the iframe's own realm to watch its body;
    // the parent one is the fallback when the frame does not expose it.
    const view = frameRef.current?.contentWindow as (Window & { ResizeObserver?: typeof ResizeObserver }) | null | undefined;
    const Observer = view?.ResizeObserver ?? (typeof ResizeObserver !== "undefined" ? ResizeObserver : undefined);
    if (!Observer) return;
    const observer = new Observer(() => measure());
    observer.observe(doc.body);
    return () => observer.disconnect();
  }, [html, device, measure]);

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="campaign-preview-live" data-coord-id={coordId} data-observe="campaign-preview">
      <figure className="m-0 grid gap-2 justify-items-center" data-testid="campaign-preview-email-block">
        <figcaption className="w-full text-center text-sm font-semibold" data-testid="campaign-preview-email-label">
          Email
        </figcaption>
        <iframe
          ref={frameRef}
          title="Previsualizacion email"
          srcDoc={html}
          onLoad={measure}
          scrolling="no"
          className="mx-auto block w-full rounded-xl border"
          style={{ height, maxWidth: device === "mobile" ? 380 : "100%" }}
          data-testid="campaign-preview-email"
          data-preview-height={height}
        />
      </figure>
      <figure className="m-0 grid content-start justify-items-center gap-2" data-testid="campaign-preview-whatsapp-block">
        <figcaption className="text-center text-sm font-semibold" data-testid="campaign-preview-whatsapp-label">
          WhatsApp
        </figcaption>
        {/* The same phone the customer holds: the composed WhatsApp text is the
        only source of truth, the frame and the chat only style it. */}
        <IPhoneFrame title={`WhatsApp ${brandName || "Restaurante"}`} time={IPHONE_DEFAULT_TIME} testId="campaign-preview-whatsapp-device">
          <WhatsAppPreview
            text={toWhatsAppText(markdown, brandName, websiteUrl)}
            brandName={brandName}
            logoUrl={logoUrl}
            websiteUrl={websiteUrl}
            accent={theme.accent}
            time={IPHONE_DEFAULT_TIME}
            coordId={coordId}
          />
        </IPhoneFrame>
      </figure>
    </div>
  );
}
