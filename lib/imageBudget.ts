/**
 * Global image size budget (coord id image_budget_v1).
 *
 * One rule for every upload: a file that already fits the byte budget (and has
 * an accepted type) is returned untouched, because re-encoding a small,
 * well-compressed image can make it BIGGER and then fail the "could not reduce"
 * check. Only oversized files are re-encoded, walking quality first and then
 * scale, so an encode never gives up while a smaller size would still fit.
 */

export type ImageBudgetOptions = {
  /** Output MIME type for re-encodes. */
  type?: string;
  /** Types kept as-is when the file already fits. Defaults to the output type. */
  keepTypes?: readonly string[];
  /** Longest edge of the first attempt, in px. */
  maxEdge?: number;
  /** Output file name (extension is derived from `type`). */
  name?: string;
};

const QUALITY_STEPS = [0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36];
const SCALE_STEP = 0.8;
const MAX_SCALE_ATTEMPTS = 8;
const MIN_EDGE = 64;

export function formatBudget(maxBytes: number): string {
  return maxBytes >= 1024 * 1024 ? `${Math.round(maxBytes / (1024 * 1024))}MB` : `${Math.round(maxBytes / 1024)}KB`;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo codificar la imagen"))), type, quality),
  );
}

function outputName(name: string, type: string): string {
  const base = String(name || "imagen").replace(/\.[^.]+$/, "").trim().replace(/\s+/g, "-") || "imagen";
  return `${base}.${type.split("/")[1] || "webp"}`;
}

/**
 * Encodes `draw` output under `maxBytes`. `draw(canvas, scale)` must size the
 * canvas and paint the image at the given scale (1 = full size).
 */
export async function encodeUnderBytes(
  draw: (canvas: HTMLCanvasElement, scale: number) => void,
  maxBytes: number,
  { type = "image/webp", name = "imagen" }: Pick<ImageBudgetOptions, "type" | "name"> = {},
): Promise<File> {
  const canvas = document.createElement("canvas");
  let scale = 1;
  for (let attempt = 0; attempt < MAX_SCALE_ATTEMPTS; attempt += 1) {
    draw(canvas, scale);
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasBlob(canvas, type, quality);
      if (blob.size <= maxBytes) return new File([blob], outputName(name, blob.type || type), { type: blob.type || type });
    }
    if (Math.min(canvas.width, canvas.height) * SCALE_STEP < MIN_EDGE) break;
    scale *= SCALE_STEP;
  }
  console.warn("[image_budget_v1] encode_over_budget", { maxBytes, width: canvas.width, height: canvas.height });
  throw new Error(`No se pudo reducir la imagen por debajo de ${formatBudget(maxBytes)}`);
}

/** Returns the file untouched when it already fits; otherwise re-encodes it. */
export async function fitImageToBytes(file: File, maxBytes: number, options: ImageBudgetOptions = {}): Promise<File> {
  const type = options.type ?? "image/webp";
  const keepTypes = options.keepTypes ?? [type];
  if (file.size > 0 && file.size <= maxBytes && keepTypes.includes(file.type)) return file;

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("No se pudo leer la imagen");
  });
  try {
    const longest = Math.max(bitmap.width, bitmap.height, 1);
    const base = options.maxEdge && longest > options.maxEdge ? options.maxEdge / longest : 1;
    return await encodeUnderBytes(
      (canvas, scale) => {
        canvas.width = Math.max(1, Math.round(bitmap.width * base * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * base * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No se pudo procesar la imagen");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      },
      maxBytes,
      { type, name: options.name ?? file.name },
    );
  } finally {
    bitmap.close?.();
  }
}
