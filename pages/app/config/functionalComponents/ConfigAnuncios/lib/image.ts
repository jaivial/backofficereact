const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIMENSION = 256; // ads render small; never shrink below a usable size
// Highest quality first: the loop stops at the first quality whose payload fits
// the budget, so the compressed webp stays as close to the cap (and as
// detailed) as possible instead of being shrunk further than needed.
const QUALITY_STEPS = [1, 0.97, 0.94, 0.9, 0.85, 0.8, 0.72, 0.64, 0.56, 0.48, 0.4];

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("No se pudo leer la imagen"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir la imagen")), "image/webp", quality));
}

function webpFile(blob: Blob, fileName: string): File {
  const base = fileName.replace(/\.[^.]+$/, "") || "anuncio";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

/**
 * Enforces the 5 MB ads image budget.
 *
 * Within the budget the original file is returned untouched (same bytes, same
 * format, same size) so an upload never loses quality it does not have to.
 * Only a larger file is re-encoded: the highest quality that fits the budget is
 * used, and the image is downscaled only when even the lowest quality at the
 * current size is still over budget.
 */
export async function compressAdImage(file: File): Promise<File> {
  if (file.size > 0 && file.size <= MAX_BYTES) {
    return file;
  }

  const img = await loadImage(file);
  let scale = 1;
  let best: Blob | null = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    if (Math.max(width, height) < MIN_DIMENSION) break;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of QUALITY_STEPS) {
      const blob = await canvasBlob(canvas, quality);
      if (blob.size <= MAX_BYTES) {
        return webpFile(blob, file.name);
      }
      if (!best || blob.size < best.size) best = blob;
    }

    scale *= 0.85;
  }

  if (!best) {
    throw new Error("No se pudo preparar la imagen");
  }
  // Best effort when even the smallest attempt is over budget: send it anyway so
  // the pick is not lost.
  return webpFile(best, file.name);
}
