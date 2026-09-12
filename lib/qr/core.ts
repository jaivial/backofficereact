import { toDataURL, toString as qrToString } from "qrcode";

export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export type QrRenderOptions = {
  /** Pixel size of the square QR image. Default 512. */
  size?: number;
  /** Quiet-zone margin in modules. Default 2. */
  margin?: number;
  /** Default "M". */
  errorCorrectionLevel?: QrErrorCorrection;
  /** Dark module color. Default "#000000". */
  dark?: string;
  /** Light/background color. Default "#ffffff". */
  light?: string;
};

type ResolvedQrOptions = {
  size: number;
  margin: number;
  errorCorrectionLevel: QrErrorCorrection;
  dark: string;
  light: string;
};

const QR_OPTION_DEFAULTS: ResolvedQrOptions = {
  size: 512,
  margin: 2,
  errorCorrectionLevel: "M",
  dark: "#000000",
  light: "#ffffff",
};

/** Coordination id emitted wherever the core renders on screen. */
export const QR_CORE_COORD_ID = "qr-core:render";

function resolveOptions(options: QrRenderOptions = {}): ResolvedQrOptions {
  return {
    size: options.size ?? QR_OPTION_DEFAULTS.size,
    margin: options.margin ?? QR_OPTION_DEFAULTS.margin,
    errorCorrectionLevel: options.errorCorrectionLevel ?? QR_OPTION_DEFAULTS.errorCorrectionLevel,
    dark: options.dark ?? QR_OPTION_DEFAULTS.dark,
    light: options.light ?? QR_OPTION_DEFAULTS.light,
  };
}

/** Normalizes/trims a raw string into a safe QR payload. */
export function sanitizeQrValue(raw: string): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

/** Async PNG data URL (image/png;base64,...). */
export async function toDataUrl(value: string, options?: QrRenderOptions): Promise<string> {
  const text = sanitizeQrValue(value);
  if (!text) throw new Error("QR value is empty");

  const { size, margin, dark, light, errorCorrectionLevel } = resolveOptions(options);
  return toDataURL(text, {
    type: "image/png",
    width: size,
    margin,
    errorCorrectionLevel,
    color: { dark, light },
  });
}

/** Async standalone SVG document markup (a full <svg>...</svg> string). */
export async function toSvgString(value: string, options?: QrRenderOptions): Promise<string> {
  const text = sanitizeQrValue(value);
  if (!text) throw new Error("QR value is empty");

  const { size, margin, dark, light, errorCorrectionLevel } = resolveOptions(options);
  const svg = await qrToString(text, {
    type: "svg",
    margin,
    errorCorrectionLevel,
    color: { dark, light },
  });

  // qrcode emits viewBox/xmlns without width/height; pin them to the requested size.
  return svg.replace(/^<svg\b/, `<svg width="${size}" height="${size}"`);
}
