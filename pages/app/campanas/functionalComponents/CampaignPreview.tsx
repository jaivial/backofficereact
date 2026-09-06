import React, { useEffect, useState } from "react";
import type { CampaignTheme } from "../../../../api/types";
import { toWhatsAppText } from "./campaignsApi";

// Live preview: the markdown is rendered in the browser on every keystroke, so
// no request is needed while typing. The shell mirrors the transactional email
// template rendered by the backend at send time.

type CampaignPreviewProps = {
  markdown: string;
  theme: CampaignTheme;
  brandName: string;
  logoURL: string;
  device: "mobile" | "desktop";
};

type MarkdownComponent = React.ComponentType<{ source: string; style?: React.CSSProperties }>;

export function CampaignPreview({ markdown, theme, brandName, logoURL, device }: CampaignPreviewProps) {
  const [Markdown, setMarkdown] = useState<MarkdownComponent | null>(null);

  useEffect(() => {
    let alive = true;
    void import("@uiw/react-md-editor").then((mod) => {
      if (alive) setMarkdown(() => mod.default.Markdown as unknown as MarkdownComponent);
    });
    return () => {
      alive = false;
    };
  }, []);

  const width = device === "mobile" ? Math.min(theme.maxWidth, 380) : theme.maxWidth;

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="campaign-preview-live">
      <div style={{ background: theme.background, padding: 16, borderRadius: 12, overflowX: "auto" }} data-testid="campaign-preview-email-frame">
        <div
          style={{
            maxWidth: width,
            margin: "0 auto",
            background: theme.surface,
            borderRadius: 8,
            overflow: "hidden",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            fontFamily: theme.fontFamily,
          }}
          data-testid="campaign-preview-email-card"
        >
          {logoURL && (
            <div style={{ background: theme.accent, padding: "24px 16px", textAlign: "center" }} data-testid="campaign-preview-email-header">
              <img src={logoURL} alt={brandName} style={{ maxWidth: 180, height: "auto" }} data-testid="campaign-preview-email-logo" />
            </div>
          )}
          <div style={{ padding: 24, color: theme.text, textAlign: theme.align }} data-testid="campaign-preview-email-body">
            {Markdown ? (
              <Markdown source={markdown} style={{ background: "transparent", color: theme.text, fontFamily: theme.fontFamily }} />
            ) : (
              <pre style={{ whiteSpace: "pre-wrap" }} data-testid="campaign-preview-email-plain">{markdown}</pre>
            )}
            <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "24px 0" }} />
            <p style={{ fontSize: 12, color: "#666", textAlign: "center" }} data-testid="campaign-preview-email-footer">
              Este es un email automatico, por favor no responda a este mensaje.
              <br />© {brandName}
            </p>
          </div>
        </div>
      </div>
      <pre className="whitespace-pre-wrap rounded-xl border p-3 text-sm" data-testid="campaign-preview-whatsapp">
        {toWhatsAppText(markdown)}
      </pre>
    </div>
  );
}
