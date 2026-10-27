import type { RestaurantAd, RestaurantAdDesign, RestaurantAdDesignKind } from "../api/types";
import type { BlockContext } from "../ui/htmlBuilder/blocks";
import { BORDER_PREFLIGHT_CSS, EMAIL_RESET_CSS } from "../ui/htmlBuilder/css";
import { normalizeDesign, stripIds } from "../ui/htmlBuilder/document";
import { defaultDraft, designFromDraft, draftFromDesign, switchKind, syncSteps } from "../pages/app/anuncios/functionalComponents/editor/adDesign";
import { draftFromLegacy } from "../pages/app/anuncios/functionalComponents/editor/adLegacy";
import { compileCampaignEmailCss } from "./campaignEmailCss";
// Registers the server DOM parser the design model needs (jsdom).
import "./campaignEmailCompile";

/*
 * Ad actions of the design engine (ads_html_editor_v1), POST
 * /bo-tools/campaign-design with action ad_*: the SAME ad model as the
 * backoffice editor (pages/app/anuncios/functionalComponents/editor), so the
 * Forky / WhatsApp ad tools and the editor build identical ads.
 *
 *   ad_compile  pages [{html}]           -> pages [{html sanitized, css}]
 *   ad_default  kind, ctx                -> design (starting template)
 *   ad_sync     design, ctx              -> design (a step per card, card titles)
 *   ad_kind     design, kind, ctx        -> design (single <-> multiple keeping the work)
 *   ad_convert  ad (legacy), ctx, website -> design (previous editor -> HTML)
 */

/** Most pages an HTML ad can send at once: the main page and 20 steps. */
const MAX_AD_PAGES = 21;

export type AdDesignRequest = {
  action: string;
  pages?: { html?: string }[];
  kind?: string;
  design?: RestaurantAdDesign | null;
  ad?: RestaurantAd | null;
  website?: string;
};

type Result = { success: boolean } & Record<string, unknown>;

const kindOf = (v: unknown): RestaurantAdDesignKind | null => (v === "single" || v === "multiple" ? v : null);

function validDesign(d: RestaurantAdDesign | null | undefined): d is RestaurantAdDesign {
  return Boolean(d && kindOf(d.kind) && d.main && typeof d.main.html === "string");
}

export async function runAdDesignAction(req: AdDesignRequest, ctx: BlockContext): Promise<Result> {
  switch (req.action) {
    case "ad_compile": {
      // Every page sanitized with the builder's rules and with its CSS
      // compiled: the same base reset the editor canvas uses plus the Tailwind
      // of its classes, so the public render paints what the editor showed.
      const pages = Array.isArray(req.pages) ? req.pages : [];
      if (!pages.length || pages.length > MAX_AD_PAGES) return { success: false, message: `Un anuncio tiene entre 1 y ${MAX_AD_PAGES} páginas` };
      const out: { html: string; css: string }[] = [];
      for (const page of pages) {
        const html = stripIds(normalizeDesign(String(page?.html ?? "")));
        out.push({ html, css: html ? BORDER_PREFLIGHT_CSS + EMAIL_RESET_CSS + (await compileCampaignEmailCss(html)) : "" });
      }
      return { success: true, pages: out };
    }
    case "ad_default": {
      const kind = kindOf(req.kind) ?? "single";
      return { success: true, design: designFromDraft(defaultDraft(kind, ctx)) };
    }
    case "ad_sync": {
      if (!validDesign(req.design)) return { success: false, message: "Diseño de anuncio no válido" };
      return { success: true, design: designFromDraft(syncSteps(draftFromDesign(req.design), ctx)) };
    }
    case "ad_kind": {
      const kind = kindOf(req.kind);
      if (!kind) return { success: false, message: "kind debe ser single o multiple" };
      if (!validDesign(req.design)) return { success: false, message: "Diseño de anuncio no válido" };
      return { success: true, design: designFromDraft(syncSteps(switchKind(draftFromDesign(req.design), kind, ctx), ctx)) };
    }
    case "ad_convert": {
      if (!req.ad) return { success: false, message: "Falta el anuncio" };
      return { success: true, design: designFromDraft(draftFromLegacy(req.ad, ctx, String(req.website ?? ""))) };
    }
    default:
      return { success: false, message: `Acción desconocida: ${req.action}` };
  }
}
