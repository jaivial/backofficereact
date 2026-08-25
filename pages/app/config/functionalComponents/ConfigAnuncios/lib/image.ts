const MAX_BYTES = 100 * 1024;

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
  const img = await loadImage(file);
  let scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
  let best: Blob | null = null;
  for (let sizeAttempt = 0; sizeAttempt < 5; sizeAttempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42, 0.32]) {
      const blob = await canvasBlob(canvas, quality);
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= MAX_BYTES) return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "anuncio"}.webp`, { type: "image/webp" });
    }
    scale *= 0.78;
  }
  if (!best || best.size > MAX_BYTES) throw new Error("No se pudo comprimir la imagen por debajo de 100 KB");
  return new File([best], "anuncio.webp", { type: "image/webp" });
}
