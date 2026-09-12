/**
 * QR module — template catalog + standalone SVG frame renderer ("Personalizar" tab).
 *
 * Coordination points:
 *  - `qr-templates:svg`   → root `<svg>` of every generated document.
 *  - `qr-templates:<part>` → named layers (`data-slot`) inside the document.
 * Every template is an id `qr-<category>-NN` (NN = 01-based index inside its category).
 * Frames are composed from one shared vocabulary (wash/border/ornament/banner) so the
 * 45 designs come from ~6 drawing helpers instead of 45 copy-pasted blobs.
 *
 * Deterministic / SSR-safe: no randomness, no external fonts or images.
 */

import { ratioById } from "./ratios";

export type QrTemplateCategory =
  | "photo-frame"
  | "instagram-post"
  | "instagram-story"
  | "minimal"
  | "classic"
  | "menu";

export type QrTemplate = {
  id: string;
  name: string;
  category: QrTemplateCategory;
  accent: string;
  background: string;
  textColor: string;
};

export type BuildTemplateSvgOptions = {
  templateId: string;
  ratioId: string;
  qrDataUrl: string;
  caption?: string;
  brand?: string;
};

// ---------------------------------------------------------------- catalog data

const CATEGORY_ORDER: QrTemplateCategory[] = [
  "photo-frame",
  "instagram-post",
  "instagram-story",
  "minimal",
  "classic",
  "menu",
];

const CATEGORY_COUNT: Record<QrTemplateCategory, number> = {
  "photo-frame": 10,
  "instagram-post": 10,
  "instagram-story": 10,
  minimal: 5,
  classic: 5,
  menu: 5,
};

const CATEGORY_NAMES: Record<QrTemplateCategory, string[]> = {
  "photo-frame": [
    "Marco Studio",
    "Marco Dorado",
    "Marco Polaroid",
    "Marco Vitrina",
    "Marco Terciopelo",
    "Marco Bahía",
    "Marco Cobre",
    "Marco Niebla",
    "Marco Roble",
    "Marco Esmeralda",
  ],
  "instagram-post": [
    "Post Cuadrado",
    "Post Coral",
    "Post Neón",
    "Post Pastel",
    "Post Kraft",
    "Post Pop",
    "Post Gradiente",
    "Post Retro",
    "Post Bazar",
    "Post Confeti",
  ],
  "instagram-story": [
    "Story Nocturna",
    "Story Aurora",
    "Story Vertical",
    "Story Flash",
    "Story Susurro",
    "Story Fiesta",
    "Story Marea",
    "Story Cómic",
    "Story Jardín",
    "Story Titán",
  ],
  minimal: ["Lino Claro", "Tinta Suave", "Papel Blanco", "Grafito", "Piedra"],
  classic: ["Clásico Oro", "Clásico Nogal", "Clásico Bordó", "Clásico Marina", "Clásico Ceniza"],
  menu: ["Carta Bistró", "Carta Taberna", "Carta Mercado", "Carta Brasa", "Carta Huerta"],
};

type TemplateLook = Pick<QrTemplate, "accent" | "background" | "textColor">;

const CATEGORY_LOOKS: Record<QrTemplateCategory, TemplateLook[]> = {
  "photo-frame": [
    { accent: "#d8b26a", background: "#14110d", textColor: "#f5efe2" },
    { accent: "#e8e2d6", background: "#1b1b1b", textColor: "#f2f0ea" },
    { accent: "#8fb8a8", background: "#10201c", textColor: "#eaf4ef" },
    { accent: "#c96f4a", background: "#1e1512", textColor: "#f7ece5" },
    { accent: "#b9a7d6", background: "#171425", textColor: "#f0ecf8" },
    { accent: "#e3c9a8", background: "#2a2118", textColor: "#f8f1e6" },
    { accent: "#7fa8d6", background: "#101823", textColor: "#e9f1fa" },
    { accent: "#cfcfcf", background: "#232323", textColor: "#f5f5f5" },
    { accent: "#d9a0a0", background: "#241414", textColor: "#f8eaea" },
    { accent: "#a8c48a", background: "#16200f", textColor: "#f0f6e9" },
  ],
  "instagram-post": [
    { accent: "#ff5c7a", background: "#fff6f7", textColor: "#3a1220" },
    { accent: "#6c5ce7", background: "#f5f3ff", textColor: "#26205c" },
    { accent: "#00b894", background: "#f0fdf9", textColor: "#0c3a30" },
    { accent: "#ffb703", background: "#fffdf3", textColor: "#4a3200" },
    { accent: "#2d9cdb", background: "#f2f9ff", textColor: "#0b2c44" },
    { accent: "#e85d04", background: "#fff5ec", textColor: "#4a1c00" },
    { accent: "#12b3a8", background: "#eefcfb", textColor: "#06302d" },
    { accent: "#8367c7", background: "#faf7ff", textColor: "#2b1d4d" },
    { accent: "#f25f5c", background: "#fff4f4", textColor: "#4a100f" },
    { accent: "#0f9d58", background: "#f2fbf5", textColor: "#07301c" },
  ],
  "instagram-story": [
    { accent: "#ff8a3d", background: "#1a1024", textColor: "#ffece0" },
    { accent: "#4cc9f0", background: "#0b1026", textColor: "#e6f6ff" },
    { accent: "#f72585", background: "#1b0a1f", textColor: "#ffe6f4" },
    { accent: "#ffd166", background: "#20160a", textColor: "#fff3d6" },
    { accent: "#7bf1a8", background: "#08170f", textColor: "#e3fff0" },
    { accent: "#b388ff", background: "#140f26", textColor: "#ece3ff" },
    { accent: "#ff6b6b", background: "#1c0d0d", textColor: "#ffe8e8" },
    { accent: "#00d1b2", background: "#07201c", textColor: "#ddfbf4" },
    { accent: "#ffb4a2", background: "#20120f", textColor: "#ffefe9" },
    { accent: "#90caf9", background: "#0a1522", textColor: "#e6f1fd" },
  ],
  minimal: [
    { accent: "#111111", background: "#ffffff", textColor: "#1a1a1a" },
    { accent: "#8a8577", background: "#faf8f4", textColor: "#2b2823" },
    { accent: "#2f6f5e", background: "#f6fbf9", textColor: "#17322a" },
    { accent: "#5b5b5b", background: "#f7f7f7", textColor: "#202020" },
    { accent: "#b08968", background: "#fdfaf6", textColor: "#33281e" },
  ],
  classic: [
    { accent: "#b08d3f", background: "#fdf8ec", textColor: "#33290f" },
    { accent: "#6b4226", background: "#f8f2e7", textColor: "#2d1d10" },
    { accent: "#7b2233", background: "#fdf3f2", textColor: "#3a1418" },
    { accent: "#1f3f6b", background: "#f2f6fc", textColor: "#12233b" },
    { accent: "#57534e", background: "#f5f4f1", textColor: "#26231f" },
  ],
  menu: [
    { accent: "#a4501f", background: "#fdf6ec", textColor: "#3a1f0b" },
    { accent: "#7a5c1e", background: "#fbf4e2", textColor: "#332607" },
    { accent: "#2f6b3f", background: "#f4faf3", textColor: "#14331c" },
    { accent: "#8c2f2f", background: "#fdf3ef", textColor: "#3b1210" },
    { accent: "#3f5d52", background: "#f5f8f4", textColor: "#1a2b24" },
  ],
};

// ------------------------------------------------------- frame design vocabulary

type Wash = "radial" | "linear" | "diagonal" | "vignette";
type BorderKind = "double" | "hairline" | "inset" | "dashed";
type Ornament = "corners" | "arcs" | "diamonds" | "dots" | "tabs" | "none";
type Banner = "ribbon" | "bar" | "plate" | "capsule" | "none";

type FrameRecipe = { wash: Wash; border: BorderKind; ornament: Ornament; banner: Banner };

type RecipePools = { wash: Wash[]; border: BorderKind[]; ornament: Ornament[]; banner: Banner[] };

const RECIPE_POOLS: Record<QrTemplateCategory, RecipePools> = {
  "photo-frame": {
    wash: ["radial", "linear", "vignette", "diagonal"],
    border: ["double", "hairline", "inset", "dashed"],
    ornament: ["corners", "arcs", "tabs", "diamonds", "dots"],
    banner: ["plate", "ribbon", "bar", "capsule", "none"],
  },
  "instagram-post": {
    wash: ["diagonal", "radial", "linear", "vignette"],
    border: ["hairline", "double", "dashed", "inset"],
    ornament: ["dots", "corners", "diamonds", "arcs", "tabs"],
    banner: ["capsule", "bar", "ribbon", "plate", "none"],
  },
  "instagram-story": {
    wash: ["linear", "vignette", "diagonal", "radial"],
    border: ["dashed", "inset", "double", "hairline"],
    ornament: ["arcs", "dots", "corners", "tabs", "diamonds"],
    banner: ["bar", "capsule", "plate", "ribbon", "none"],
  },
  minimal: {
    wash: ["linear", "radial"],
    border: ["hairline", "inset", "double"],
    ornament: ["none", "corners", "diamonds"],
    banner: ["none", "bar", "plate"],
  },
  classic: {
    wash: ["vignette", "radial"],
    border: ["double", "inset", "hairline"],
    ornament: ["corners", "arcs", "tabs"],
    banner: ["ribbon", "plate", "bar"],
  },
  menu: {
    wash: ["linear", "diagonal"],
    border: ["inset", "dashed", "double"],
    ornament: ["tabs", "dots", "none"],
    banner: ["bar", "ribbon", "capsule"],
  },
};

/** Mixed-radix odometer: unique recipe per index up to the pool product. */
function recipeFor(category: QrTemplateCategory, index: number): FrameRecipe {
  const pools = RECIPE_POOLS[category];
  let cursor = index;
  const take = <T>(list: T[]): T => {
    const value = list[cursor % list.length];
    cursor = Math.floor(cursor / list.length);
    return value;
  };
  return { wash: take(pools.wash), border: take(pools.border), ornament: take(pools.ornament), banner: take(pools.banner) };
}

// ------------------------------------------------------------------ primitives

type SvgAttrs = Record<string, string | number>;

const FAMILY_SERIF = "Georgia, serif";
const FAMILY_SANS = "Helvetica, Arial, sans-serif";

const esc = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function node(name: string, attrs: SvgAttrs, slot: string): string {
  const rendered = Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  return `<${name} ${rendered} data-slot="${slot}" />`;
}

function textNode(
  content: string,
  x: number,
  y: number,
  size: number,
  fill: string,
  weight: number,
  family: string,
  maxWidth: number,
): string {
  const estimate = content.length * size * (family === FAMILY_SERIF ? 0.5 : 0.56);
  const clamp = estimate > maxWidth ? ` textLength="${Math.round(maxWidth)}" lengthAdjust="spacingAndGlyphs"` : "";
  return `<text x="${Math.round(x)}" y="${Math.round(y)}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="middle"${clamp} data-slot="qr-text">${esc(content)}</text>`;
}

/** Readable ink for text sitting on an accent fill. */
function onColor(hex: string): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1b1712" : "#ffffff";
}

// --------------------------------------------------------------------- layers

function defsLayer(uid: string, accent: string, wash: Wash): string {
  const stops =
    wash === "radial"
      ? `<stop offset="0%" stop-color="${accent}" stop-opacity="0.3" /><stop offset="100%" stop-color="${accent}" stop-opacity="0" />`
      : wash === "linear"
        ? `<stop offset="0%" stop-color="${accent}" stop-opacity="0.26" /><stop offset="55%" stop-color="${accent}" stop-opacity="0.04" /><stop offset="100%" stop-color="${accent}" stop-opacity="0.18" />`
        : wash === "diagonal"
          ? `<stop offset="0%" stop-color="${accent}" stop-opacity="0.28" /><stop offset="50%" stop-color="${accent}" stop-opacity="0.02" /><stop offset="100%" stop-color="${accent}" stop-opacity="0.22" />`
          : `<stop offset="55%" stop-color="#000000" stop-opacity="0" /><stop offset="100%" stop-color="#000000" stop-opacity="0.38" />`;
  const radial = wash === "radial" || wash === "vignette";
  const geometry = radial
    ? 'cx="50%" cy="46%" r="74%"'
    : wash === "linear"
      ? 'x1="0" y1="0" x2="0" y2="1"'
      : 'x1="0" y1="0" x2="1" y2="1"';
  const tag = radial ? "radialGradient" : "linearGradient";
  return `<defs data-slot="qr-defs"><${tag} id="${uid}-wash" ${geometry}>${stops}</${tag}></defs>`;
}

function borderLayer(width: number, height: number, short: number, accent: string, kind: BorderKind): string {
  const inset = Math.round(short * 0.034);
  const x = inset;
  const y = inset;
  const w = width - inset * 2;
  const h = height - inset * 2;
  const radius = Math.round(short * 0.022);
  const thick = Math.max(3, Math.round(short * 0.011));
  const thin = Math.max(2, Math.round(short * 0.004));

  if (kind === "double") {
    const gap = Math.round(short * 0.014);
    return (
      node("rect", { x, y, width: w, height: h, rx: radius, fill: "none", stroke: accent, "stroke-width": thick }, "qr-border-outer") +
      node(
        "rect",
        { x: x + gap, y: y + gap, width: w - gap * 2, height: h - gap * 2, rx: Math.max(4, radius - gap), fill: "none", stroke: accent, "stroke-width": thin },
        "qr-border-inner",
      )
    );
  }
  if (kind === "hairline") {
    return node("rect", { x, y, width: w, height: h, rx: radius, fill: "none", stroke: accent, "stroke-width": thin, "stroke-opacity": 0.9 }, "qr-border-hairline");
  }
  if (kind === "dashed") {
    const dash = `${Math.round(short * 0.022)} ${Math.round(short * 0.016)}`;
    return node("rect", { x, y, width: w, height: h, rx: radius, fill: "none", stroke: accent, "stroke-width": thick, "stroke-dasharray": dash, "stroke-opacity": 0.85 }, "qr-border-dashed");
  }
  const fold = Math.round(short * 0.03);
  return (
    node("rect", { x, y, width: w, height: h, rx: radius, fill: "none", stroke: accent, "stroke-width": thin, "stroke-opacity": 0.75 }, "qr-border-inset") +
    node(
      "path",
      {
        d: `M ${x + fold} ${y + h - fold} L ${x + fold} ${y + fold} L ${x + w - fold} ${y + fold}`,
        fill: "none",
        stroke: accent,
        "stroke-width": thick,
        "stroke-linecap": "round",
      },
      "qr-border-fold",
    )
  );
}

function ornamentLayer(width: number, height: number, short: number, accent: string, kind: Ornament): string {
  if (kind === "none") return "";
  const inset = Math.round(short * 0.06);
  const stroke = Math.max(3, Math.round(short * 0.007));

  if (kind === "corners") {
    const arm = Math.round(short * 0.075);
    const corners: Array<[number, number, number, number]> = [
      [inset, inset, 1, 1],
      [width - inset, inset, -1, 1],
      [inset, height - inset, 1, -1],
      [width - inset, height - inset, -1, -1],
    ];
    return corners
      .map(([x, y, sx, sy]) =>
        node(
          "path",
          { d: `M ${x + sx * arm} ${y} L ${x} ${y} L ${x} ${y + sy * arm}`, fill: "none", stroke: accent, "stroke-width": stroke, "stroke-linecap": "round", "stroke-linejoin": "round" },
          "qr-ornament-corners",
        ),
      )
      .join("");
  }
  if (kind === "arcs") {
    const radius = Math.round(short * 0.11);
    const corners: Array<[number, number, number, number]> = [
      [inset, inset, 1, 1],
      [width - inset, inset, -1, 1],
      [inset, height - inset, 1, -1],
      [width - inset, height - inset, -1, -1],
    ];
    return corners
      .map(([x, y, sx, sy]) =>
        node(
          "path",
          { d: `M ${x + sx * radius} ${y} A ${radius} ${radius} 0 0 ${sx * sy > 0 ? 1 : 0} ${x} ${y + sy * radius}`, fill: "none", stroke: accent, "stroke-width": stroke, "stroke-opacity": 0.8, "stroke-linecap": "round" },
          "qr-ornament-arcs",
        ),
      )
      .join("");
  }
  if (kind === "diamonds") {
    const size = Math.round(short * 0.022);
    const points: Array<[number, number]> = [
      [width / 2, inset],
      [width / 2, height - inset],
      [inset, height / 2],
      [width - inset, height / 2],
    ];
    return points
      .map(([x, y]) => node("path", { d: `M ${x} ${y - size} L ${x + size} ${y} L ${x} ${y + size} L ${x - size} ${y} Z`, fill: accent, "fill-opacity": 0.9 }, "qr-ornament-diamonds"))
      .join("");
  }
  if (kind === "dots") {
    const radius = Math.max(3, Math.round(short * 0.006));
    const step = Math.round(width * 0.05);
    const count = Math.max(3, Math.floor((width * 0.5) / step));
    const rows = [inset, height - inset];
    const cells: string[] = [];
    for (const y of rows) {
      for (let i = -count; i <= count; i += 1) {
        cells.push(node("circle", { cx: Math.round(width / 2 + i * step), cy: y, r: radius, fill: accent, "fill-opacity": 0.75 }, "qr-ornament-dots"));
      }
    }
    return cells.join("");
  }
  const tabW = Math.round(short * 0.16);
  const tabH = Math.max(4, Math.round(short * 0.018));
  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  return (
    node("rect", { x: cx - tabW / 2, y: inset - tabH / 2, width: tabW, height: tabH, rx: tabH / 2, fill: accent }, "qr-ornament-tabs") +
    node("rect", { x: cx - tabW / 2, y: height - inset - tabH / 2, width: tabW, height: tabH, rx: tabH / 2, fill: accent }, "qr-ornament-tabs") +
    node("rect", { x: inset - tabH / 2, y: cy - tabW / 2, width: tabH, height: tabW, rx: tabH / 2, fill: accent }, "qr-ornament-tabs") +
    node("rect", { x: width - inset - tabH / 2, y: cy - tabW / 2, width: tabH, height: tabW, rx: tabH / 2, fill: accent }, "qr-ornament-tabs")
  );
}

type BannerInput = {
  width: number;
  short: number;
  bandHeight: number;
  baseline: number;
  brand?: string;
  accent: string;
  textColor: string;
  kind: Banner;
};

function bannerLayer(input: BannerInput): string {
  const { width, short, bandHeight, baseline, brand, accent, textColor, kind } = input;
  if (kind === "none") {
    return brand ? textNode(brand, width / 2, baseline, Math.round(short * 0.036), textColor, 700, FAMILY_SANS, width * 0.8) : "";
  }
  if (kind === "ribbon") {
    const notch = Math.round(bandHeight * 0.28);
    const half = Math.round(bandHeight * 0.55);
    const text = brand ? textNode(brand, width / 2, baseline, Math.round(short * 0.036), onColor(accent), 700, FAMILY_SANS, width * 0.8) : "";
    return (
      node("rect", { x: 0, y: 0, width, height: bandHeight, fill: accent }, "qr-banner-ribbon") +
      node("path", { d: `M ${Math.round(width / 2 - half)} ${bandHeight} L ${Math.round(width / 2)} ${bandHeight + notch} L ${Math.round(width / 2 + half)} ${bandHeight} Z`, fill: accent }, "qr-banner-ribbon-notch") +
      text
    );
  }
  if (kind === "bar") {
    const bar = Math.max(6, Math.round(short * 0.018));
    const text = brand ? textNode(brand, width / 2, baseline + bar, Math.round(short * 0.036), textColor, 700, FAMILY_SANS, width * 0.8) : "";
    return node("rect", { x: 0, y: 0, width, height: bar, fill: accent }, "qr-banner-bar") + text;
  }
  const fontSize = Math.round(short * 0.036);
  const plateW = Math.min(Math.round(width * 0.8), Math.round((brand ? brand.length * fontSize * 0.6 : width * 0.3) + fontSize * 1.8));
  const text = brand ? textNode(brand, width / 2, baseline, fontSize, kind === "capsule" ? onColor(accent) : textColor, 700, FAMILY_SANS, plateW - fontSize) : "";
  if (kind === "capsule") {
    return (
      node("rect", { x: Math.round((width - plateW) / 2), y: Math.round(baseline - fontSize * 1.35), width: plateW, height: Math.round(fontSize * 1.95), rx: fontSize, fill: accent }, "qr-banner-capsule") + text
    );
  }
  return (
    node(
      "rect",
      {
        x: Math.round((width - plateW) / 2),
        y: Math.round(baseline - fontSize * 1.35),
        width: plateW,
        height: Math.round(fontSize * 1.95),
        rx: Math.round(fontSize * 0.35),
        fill: accent,
        "fill-opacity": 0.14,
        stroke: accent,
        "stroke-width": Math.max(2, Math.round(short * 0.003)),
      },
      "qr-banner-plate",
    ) + text
  );
}

function qrLayer(size: number, pad: number, short: number, accent: string, qrDataUrl: string): string {
  const x = -pad;
  const y = -pad;
  const plate = size + pad * 2;
  return (
    node("rect", { x, y, width: plate, height: plate, rx: Math.round(short * 0.02), fill: "#ffffff", stroke: accent, "stroke-width": Math.max(2, Math.round(short * 0.003)) }, "qr-plate") +
    node("image", { href: esc(qrDataUrl), x: 0, y: 0, width: size, height: size, preserveAspectRatio: "xMidYMid meet" }, "qr-image")
  );
}

function captionLayer(width: number, height: number, short: number, bottom: number, caption: string, accent: string, textColor: string): string {
  const baseline = Math.round(height - bottom * 0.42);
  const fontSize = Math.round(short * 0.04);
  const ruleWidth = Math.round(width * 0.14);
  const rule = node("rect", { x: (width - ruleWidth) / 2, y: Math.round(baseline - fontSize * 1.7), width: ruleWidth, height: Math.max(3, Math.round(short * 0.005)), rx: 3, fill: accent, "fill-opacity": 0.85 }, "qr-caption-rule");
  return rule + textNode(caption, width / 2, baseline, fontSize, textColor, 400, FAMILY_SERIF, width * 0.82);
}

// -------------------------------------------------------------- catalog export

const RECIPES: Record<string, FrameRecipe> = {};

function buildCatalog(): QrTemplate[] {
  const templates: QrTemplate[] = [];
  for (const category of CATEGORY_ORDER) {
    const names = CATEGORY_NAMES[category];
    const looks = CATEGORY_LOOKS[category];
    for (let index = 0; index < CATEGORY_COUNT[category]; index += 1) {
      const template: QrTemplate = {
        id: `qr-${category}-${String(index + 1).padStart(2, "0")}`,
        name: names[index],
        category,
        ...looks[index % looks.length],
      };
      templates.push(template);
      RECIPES[template.id] = recipeFor(category, index);
    }
  }
  return templates;
}

/** Exactly 45 templates with unique ids and unique names. */
export const QR_TEMPLATES: QrTemplate[] = buildCatalog();

// -------------------------------------------------------------------- builder

function findTemplate(id: string): QrTemplate {
  const template = QR_TEMPLATES.find((candidate) => candidate.id === id);
  if (!template) throw new Error(`[qr-templates:catalog] Unknown template id: ${id}`);
  return template;
}

/**
 * Returns a complete, standalone SVG document string (xmlns, width, height, viewBox)
 * composing: background, decorative frame, centered QR image, caption/brand text.
 */
export function buildTemplateSvg(options: BuildTemplateSvgOptions): string {
  const template = findTemplate(options.templateId);
  const ratio = ratioById(options.ratioId);
  const recipe = RECIPES[template.id];
  const { width, height } = ratio;
  const short = Math.min(width, height);

  const top = Math.round(height * 0.14);
  const bottom = Math.round(height * 0.14);
  const size = Math.min(Math.round(width * 0.6), Math.round(short * 0.62), Math.round((height - top - bottom) * 0.95));
  const pad = Math.round(size * 0.055);
  const qrX = Math.round((width - size) / 2);
  const qrY = Math.round((height - size) / 2);

  const bandHeight = Math.min(Math.round(top * 0.62), Math.round(short * 0.09));
  const baseline = Math.round(top * 0.45);
  const uid = `${template.id}-${ratio.id.replace(/[^a-zA-Z0-9]+/g, "")}`;

  const layers = [
    defsLayer(uid, template.accent, recipe.wash),
    node("rect", { x: 0, y: 0, width, height, fill: template.background }, "qr-background"),
    node("rect", { x: 0, y: 0, width, height, fill: `url(#${uid}-wash)` }, "qr-wash"),
    borderLayer(width, height, short, template.accent, recipe.border),
    ornamentLayer(width, height, short, template.accent, recipe.ornament),
    `<g transform="translate(${qrX} ${qrY})" data-slot="qr-qr-group">${qrLayer(size, pad, short, template.accent, options.qrDataUrl)}</g>`,
    bannerLayer({ width, short, bandHeight, baseline, brand: options.brand, accent: template.accent, textColor: template.textColor, kind: recipe.banner }),
    options.caption ? captionLayer(width, height, short, bottom, options.caption, template.accent, template.textColor) : "",
  ];

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"` +
    ` aria-label="${esc(`Plantilla QR ${template.name} (${ratio.label})`)}"` +
    ` data-testid="qr-template-svg-${template.id}-${ratio.id}"` +
    ` data-coord-id="qr-templates:svg" data-slot="qr-template-svg"` +
    ` data-template-id="${template.id}" data-ratio-id="${ratio.id}" data-template-category="${template.category}">` +
    `${layers.join("")}</svg>`
  );
}
