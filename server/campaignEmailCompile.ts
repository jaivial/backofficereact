import { JSDOM } from "jsdom";
import postcss, { type ChildNode, type Declaration } from "postcss";
import {
  BORDER_PREFLIGHT,
  EMAIL_RESET_CSS,
  designToWhatsAppMarkdown,
  emailValue,
  hasPseudo,
  parseDecls,
  resolveVars,
  safeClassName,
  safeSelector,
  type Decl,
} from "../pages/app/campanas/functionalComponents/builder/emailBuilderCompile";
import { setDesignDomParser, stripIds } from "../pages/app/campanas/functionalComponents/builder/emailBuilderDocument";
import { compileCampaignEmailCss } from "./campaignEmailCss";

/*
 * Design -> email on the backoffice server (coordination ids
 * campaign_html_builder_v1, campaign_tools_v1). The ONE compiler of campaign
 * emails: the editor calls it through POST /bo-tools/campaign-email-compile and
 * the Go backend through the same endpoint when Forky or the WhatsApp bot edit
 * a design, so both always store exactly the same email.
 *
 * Tailwind compiles the classes of the design (campaignEmailCss.ts), postcss
 * reads the rules and jsdom matches them: plain utility rules become style
 * attributes, @media and pseudo-class rules stay in a <style> block with
 * !important so they still beat the inline styles.
 */

export const CAMPAIGN_EMAIL_COMPILE_PATH = "/bo-tools/campaign-email-compile";
export const CAMPAIGN_EMAIL_COMPILE_MAX_BYTES = 1024 * 1024;

// One jsdom window for the whole process: every parse creates its own detached
// document, the window only provides the HTML parser and selector engine.
const { window: domWindow } = new JSDOM("<!DOCTYPE html><html><body></body></html>");
setDesignDomParser(() => new domWindow.DOMParser());

const declsOf = (nodes: ChildNode[] | undefined): Decl[] =>
  (nodes ?? []).filter((n): n is Declaration => n.type === "decl").map((d) => ({ prop: d.prop, value: d.value, important: Boolean(d.important) }));

function declBlock(decls: Decl[], important: boolean): string {
  const vars = new Map(decls.filter((d) => d.prop.startsWith("--")).map((d) => [d.prop, d.value] as const));
  return decls
    .filter((d) => !d.prop.startsWith("--"))
    .map((d) => `${d.prop}:${emailValue(resolveVars(d.value, vars))}${important || d.important ? "!important" : ""}`)
    .join(";");
}

/** A rule that cannot be inlined, serialized for the <style> block. */
function residualRule(node: ChildNode, important: boolean): string {
  if (node.type === "rule") return `${safeSelector(node.selector)}{${declBlock(declsOf(node.nodes), important)}}`;
  if (node.type === "atrule" && node.name === "media") return `@media ${node.params}{${(node.nodes ?? []).map((n) => residualRule(n, true)).join("")}}`;
  if (node.type === "comment") return "";
  return node.toString();
}

const escapeText = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inlines compiled Tailwind CSS into a design and wraps it as a full email document. */
export function inlineEmail(design: string, css: string, title: string): string {
  const doc = new domWindow.DOMParser().parseFromString(`<!DOCTYPE html><html><head></head><body>${stripIds(design)}</body></html>`, "text/html");
  const perElement = new Map<Element, Decl[]>();
  const residual: string[] = [];
  for (const node of postcss.parse(css).nodes) {
    if (node.type === "rule" && !hasPseudo(node.selector)) {
      let targets: Element[] = [];
      try {
        targets = Array.from(doc.body.querySelectorAll(node.selector));
      } catch {
        residual.push(residualRule(node, false));
        continue;
      }
      const decls = declsOf(node.nodes);
      for (const el of targets) perElement.set(el, [...(perElement.get(el) ?? []), ...decls]);
    } else {
      residual.push(residualRule(node, false));
    }
  }
  for (const [el, decls] of perElement) {
    const authored = parseDecls(el.getAttribute("style") ?? "");
    const vars = new Map(decls.filter((d) => d.prop.startsWith("--")).map((d) => [d.prop, d.value] as const));
    const own = decls.filter((d) => !d.prop.startsWith("--"));
    const bordered = own.some((d) => /^border(-(top|right|bottom|left|x|y))?-width$|^border(-(top|right|bottom|left))?$/.test(d.prop));
    // setProperty semantics: the later declaration wins and moves last, so a
    // longhand set after its shorthand keeps overriding it.
    const style = new Map<string, { value: string; important: boolean }>();
    for (const d of [...(bordered ? BORDER_PREFLIGHT : []), ...own, ...authored]) {
      const prop = d.prop === "text-decoration-line" ? "text-decoration" : d.prop;
      style.delete(prop);
      style.set(prop, { value: emailValue(resolveVars(d.value, vars)), important: d.important });
    }
    el.setAttribute("style", Array.from(style, ([prop, v]) => `${prop}: ${v.value}${v.important ? " !important" : ""};`).join(" "));
  }
  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    for (const attr of Array.from(el.attributes)) if (attr.name.startsWith("data-eb-")) el.removeAttribute(attr.name);
    const cls = el.getAttribute("class");
    if (cls) el.setAttribute("class", cls.split(/\s+/).filter(Boolean).map(safeClassName).join(" "));
  }
  // The page background of the design also paints the body (no white band under it).
  const rootStyle = parseDecls(doc.body.firstElementChild?.getAttribute("style") ?? "");
  const rootBg = rootStyle.filter((d) => d.prop === "background-color").pop()?.value ?? "";
  const bodyStyle = `margin:0;padding:0;${rootBg ? `background-color:${rootBg};` : ""}`;
  return (
    `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<meta name="x-apple-disable-message-reformatting">\n<meta name="color-scheme" content="light">\n<title>${escapeText(title)}</title>\n` +
    `<style>${EMAIL_RESET_CSS}${residual.join("")}</style>\n</head>\n<body style="${bodyStyle}">\n${doc.body.innerHTML.trim()}\n</body>\n</html>\n`
  );
}

export type CompiledCampaignEmail = { emailHtml: string; whatsappMarkdown: string; cssBytes: number };

/** Full pipeline: design -> compiled, inlined, sendable email plus its WhatsApp text. */
export async function compileCampaignEmail(design: string, title: string): Promise<CompiledCampaignEmail> {
  const clean = stripIds(design);
  const css = await compileCampaignEmailCss(clean);
  return { emailHtml: inlineEmail(clean, css, title || "Campaña"), whatsappMarkdown: designToWhatsAppMarkdown(clean), cssBytes: css.length };
}
