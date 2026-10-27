/*
 * Palette contract of the HTML builder (html_builder_shared_v1). Each profile
 * (campaign email, web ad) ships its own blocks; a block is plain HTML with
 * Tailwind classes built from the brand context, mobile-first and responsive.
 */

export type BlockContext = {
  brandName: string;
  logoUrl: string;
  websiteUrl: string;
  /** Brand accent (campaign theme / ad accent), used for buttons and highlights. */
  accent: string;
};

export type BlockDef = { kind: string; label: string; description: string; html: (ctx: BlockContext) => string };
