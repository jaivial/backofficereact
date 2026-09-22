import { encodeUnderBytes } from "./imageBudget";

const SUPPORTED_DISH_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_DISH_IMAGE_INPUT_BYTES = 15 * 1024 * 1024;
export const DEFAULT_DISH_IMAGE_OUTPUT_SIZE = 1024;
export const DEFAULT_DISH_IMAGE_MAX_KB = 150;

export type DishImageCropParams = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  viewportSize: number;
  outputSizePx?: number;
  maxSizeKB?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const objectURL = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectURL);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectURL);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = objectURL;
  });
}

function outputName(fileName: string): string {
  const raw = String(fileName || "dish-image").trim();
  const dot = raw.lastIndexOf(".");
  const base = dot > 0 ? raw.slice(0, dot) : raw;
  return `${(base || "dish-image").replace(/\s+/g, "-")}.webp`;
}

export function isSupportedDishImageFile(file: File): boolean {
  if (!file) return false;
  return SUPPORTED_DISH_IMAGE_TYPES.has(file.type);
}

export async function cropSquareImageToWebp(file: File, params: DishImageCropParams): Promise<File> {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Selecciona una imagen valida");
  }
  if (!isSupportedDishImageFile(file)) {
    throw new Error("Formato no soportado. Usa JPG, PNG, WEBP o GIF");
  }
  if (file.size > MAX_DISH_IMAGE_INPUT_BYTES) {
    throw new Error("La imagen es demasiado grande (max 15MB)");
  }

  const viewportSize = Math.max(1, Math.round(params.viewportSize || 0));
  if (!Number.isFinite(viewportSize) || viewportSize <= 0) {
    throw new Error("No se pudo calcular el area de recorte");
  }

  const outputSize = Math.max(128, Math.round(params.outputSizePx || DEFAULT_DISH_IMAGE_OUTPUT_SIZE));
  const maxBytes = Math.max(1, Math.round((params.maxSizeKB || DEFAULT_DISH_IMAGE_MAX_KB) * 1024));

  const image = await loadImage(file);
  const naturalWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const naturalHeight = Math.max(1, image.naturalHeight || image.height || 1);

  const zoom = clamp(Number.isFinite(params.zoom) ? params.zoom : 1, 1, 4);
  const baseScale = Math.max(viewportSize / naturalWidth, viewportSize / naturalHeight);
  const renderedWidth = naturalWidth * baseScale * zoom;
  const renderedHeight = naturalHeight * baseScale * zoom;

  const maxOffsetX = Math.max(0, (renderedWidth - viewportSize) / 2);
  const maxOffsetY = Math.max(0, (renderedHeight - viewportSize) / 2);
  const offsetX = clamp(params.offsetX || 0, -maxOffsetX, maxOffsetX);
  const offsetY = clamp(params.offsetY || 0, -maxOffsetY, maxOffsetY);

  const imageLeft = (viewportSize - renderedWidth) / 2 + offsetX;
  const imageTop = (viewportSize - renderedHeight) / 2 + offsetY;

  const srcXRaw = ((0 - imageLeft) / renderedWidth) * naturalWidth;
  const srcYRaw = ((0 - imageTop) / renderedHeight) * naturalHeight;
  const srcWRaw = (viewportSize / renderedWidth) * naturalWidth;
  const srcHRaw = (viewportSize / renderedHeight) * naturalHeight;

  const srcX = clamp(srcXRaw, 0, naturalWidth - 1);
  const srcY = clamp(srcYRaw, 0, naturalHeight - 1);
  const srcW = clamp(srcWRaw, 1, naturalWidth - srcX);
  const srcH = clamp(srcHRaw, 1, naturalHeight - srcY);

  return encodeUnderBytes(
    (canvas, scale) => {
      const size = Math.max(1, Math.round(outputSize * scale));
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo preparar el recorte");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, size, size);
    },
    maxBytes,
    { name: outputName(file.name) },
  );
}
