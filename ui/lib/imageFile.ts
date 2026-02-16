function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo codificar la imagen"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
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

function baseName(fileName: string): string {
  const n = String(fileName || "avatar").trim();
  const dot = n.lastIndexOf(".");
  const raw = dot > 0 ? n.slice(0, dot) : n;
  return raw || "avatar";
}

export async function imageToWebpMax200KB(file: File): Promise<File> {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("La imagen es demasiado grande (max 15MB)");
  }

  const img = await loadImage(file);
  const maxBytes = 200 * 1024;
  const maxSide = 1400;
  const qualitySteps = [0.92, 0.88, 0.84, 0.8, 0.76, 0.72, 0.68, 0.64, 0.6, 0.56, 0.52, 0.48, 0.44];

  let scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  let bestBlob: Blob | null = null;

  for (let dimensionAttempt = 0; dimensionAttempt < 6; dimensionAttempt++) {
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar el procesamiento de imagen");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of qualitySteps) {
      const blob = await canvasToBlob(canvas, "image/webp", quality);
      bestBlob = blob;
      if (blob.size <= maxBytes) {
        return new File([blob], `${baseName(file.name)}.webp`, { type: "image/webp" });
      }
    }

    scale *= 0.82;
  }

  if (!bestBlob) throw new Error("No se pudo convertir la imagen");
  throw new Error("No se pudo reducir la imagen por debajo de 200KB");
}
