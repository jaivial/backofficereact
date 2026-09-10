const MAX_BYTES = 5 * 1024 * 1024;
const MIN_DIMENSION = 256; // ads render small; never shrink below a usable size
// Highest quality first: the loop stops at the first quality whose payload fits
// the budget, so the compressed file stays as close to the cap (and as detailed)
// as possible instead of being shrunk further than needed.
const QUALITY_STEPS = [1, 0.97, 0.94, 0.9, 0.85, 0.8, 0.72, 0.64, 0.56, 0.48, 0.4];
// Browsers that cannot encode WebP (iOS Safari) silently return a PNG from
// canvas.toBlob, and PNG ignores the quality argument: the ladder becomes
// useless and the image is downscaled until it fits. Probe the encoder and fall
// back to JPEG, which every browser encodes with a real quality knob.
const ENCODE_TYPES = ["image/webp", "image/jpeg"] as const;

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

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("No se pudo convertir la imagen")), type, quality));
}

/** Encoder this browser actually honours (WebP when available, JPEG otherwise). */
async function pickEncoder(canvas: HTMLCanvasElement): Promise<string> {
  for (const type of ENCODE_TYPES) {
    const probe = await canvasBlob(canvas, type, 0.9);
    if ((probe.type || type) === type) return type;
  }
  return "image/jpeg";
}

function extensionFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("gif")) return "gif";
  return "webp";
}

/** File whose name and type match the bytes that were actually encoded. */
function encodedFile(blob: Blob, fileName: string): File {
  const base = fileName.replace(/\.[^.]+$/, "") || "anuncio";
  const mime = blob.type || "image/webp";
  return new File([blob], `${base}.${extensionFor(mime)}`, { type: mime });
}

/** Byte length the browser reports, falling back to the real one when it is 0. */
async function knownSize(file: File): Promise<number> {
  if (file.size > 0) return file.size;
  try {
    return (await file.arrayBuffer()).byteLength;
  } catch {
    return 0;
  }
}

/**
 * Enforces the 5 MB ads image budget.
 *
 * Within the budget the original file is returned untouched (same bytes, same
 * format, same size) so an upload never loses quality it does not have to. Only
 * a larger file is re-encoded, at the highest quality the browser can produce
 * that fits the budget, and the image is downscaled only when even the lowest
 * quality at the current size is still over budget.
 */
export async function compressAdImage(file: File): Promise<File> {
  const size = await knownSize(file);
  if (size > 0 && size <= MAX_BYTES) {
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

    const encoder = await pickEncoder(canvas);
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasBlob(canvas, encoder, quality);
      if (blob.size <= MAX_BYTES) {
        return encodedFile(blob, file.name);
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
  return encodedFile(best, file.name);
}
