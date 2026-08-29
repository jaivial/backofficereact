const MAX_BYTES = 100 * 1024;
const MAX_DIMENSION = 1600;
const MIN_DIMENSION = 256; // ads render small; never shrink below a usable size

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

export async function compressAdImage(file: File): Promise<File> {
  // Fast path: the source is already small enough to upload, so re-encoding
  // (which can inflate an already-compressed JPEG beyond the cap) is pointless.
  // The backend normalizes to webp anyway, so pass it through untouched.
  if (file.size > 0 && file.size <= MAX_BYTES) {
    console.log("[AD-DEBUG] compressAdImage fast-path source within budget", { name: file?.name, type: file?.type, size: file?.size });
    return file;
  }
  console.log("[AD-DEBUG] compressAdImage start", { name: file?.name, type: file?.type, size: file?.size });
  const img = await loadImage(file).then(
    (v) => { console.log("[AD-DEBUG] loadImage OK", { nw: v?.naturalWidth, nh: v?.naturalHeight }); return v; },
    (e) => { console.log("[AD-DEBUG] loadImage ERROR", { message: e?.message }); throw e; },
  );
  // Start at a reasonable cap, then keep shrinking on every attempt so any
  // image (noisy photos, screenshots, high-detail art) can be forced under
  // 100 KB instead of failing after a fixed number of attempts.
  const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
  let scale = Math.min(1, MAX_DIMENSION / maxDim);
  let best: Blob | null = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    if (Math.max(width, height) < MIN_DIMENSION) { console.log("[AD-DEBUG] break at min dimension", { width, height }); break; }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) { console.log("[AD-DEBUG] no 2d context", { width, height }); throw new Error("No se pudo procesar la imagen"); }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);
    const sizes: number[] = [];
    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42, 0.32]) {
      const blob = await canvasBlob(canvas, quality);
      sizes.push(blob.size);
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= MAX_BYTES) {
        console.log("[AD-DEBUG] success", { attempt, width, height, sizes });
        return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "anuncio"}.webp`, { type: "image/webp" });
      }
    }
    console.log("[AD-DEBUG] attempt sizes", { attempt, width, height, sizes });
    scale *= 0.78;
  }
  console.log("[AD-DEBUG] exhausted attempts", { bestSize: best?.size });
  if (!best) {
    throw new Error("No se pudo preparar la imagen");
  }
  // Best effort: if the strongest downsample is still over budget, send the
  // smallest result anyway rather than failing the pick. The backend will do
  // its own final normalization to the target size.
  if (best.size > MAX_BYTES) {
    console.warn("[AD-DEBUG] returning best-effort webp above budget", { bestSize: best.size });
  }
  return new File([best], "anuncio.webp", { type: "image/webp" });
}