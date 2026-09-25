/**
 * Product cutout (coord id wine_image_cutout_v1).
 *
 * Removes the photo background in the browser and trims the result to the
 * object's bounding box, so no empty margin is left between the object and
 * the file edges. Output is a transparent PNG.
 */

const ALPHA_THRESHOLD = 8;

function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

function alphaBounds(data: Uint8ClampedArray, width: number, height: number) {
  let top = height, left = width, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= ALPHA_THRESHOLD) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Trims fully transparent borders; returns the source when nothing is trimmable. */
export async function trimTransparent(blob: Blob, name: string): Promise<File> {
  const bitmap = await loadBitmap(blob);
  const src = document.createElement("canvas");
  src.width = bitmap.width;
  src.height = bitmap.height;
  const ctx = src.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.drawImage(bitmap, 0, 0);
  const box = alphaBounds(ctx.getImageData(0, 0, src.width, src.height).data, src.width, src.height);
  if (!box) throw new Error("No se detectó ningún objeto en la imagen");
  const out = document.createElement("canvas");
  out.width = box.width;
  out.height = box.height;
  out.getContext("2d")?.drawImage(src, box.left, box.top, box.width, box.height, 0, 0, box.width, box.height);
  const png = await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo codificar la imagen"))), "image/png"),
  );
  console.info("[wine_image_cutout_v1] trimmed", { from: [src.width, src.height], to: [box.width, box.height] });
  return new File([png], name, { type: "image/png" });
}

// MIT-licensed segmentation model run by @huggingface/transformers
// (Apache-2.0). fp16 keeps the one-time, browser-cached download ~115MB.
const CUTOUT_MODEL = "onnx-community/BiRefNet_lite-ONNX";

type Segmenter = (image: string) => Promise<{ toBlob: (type?: string) => Promise<Blob> }>;
let segmenterPromise: Promise<Segmenter> | null = null;

function loadSegmenter(): Promise<Segmenter> {
  if (!segmenterPromise) {
    segmenterPromise = import("@huggingface/transformers")
      .then(({ pipeline }) => pipeline("background-removal", CUTOUT_MODEL, { dtype: "fp16" }) as unknown as Promise<Segmenter>)
      .catch((e) => {
        segmenterPromise = null;
        throw e;
      });
  }
  return segmenterPromise;
}

/** Background removal + auto-crop to the object bounds. */
export async function cutoutProduct(file: File): Promise<File> {
  const started = performance.now();
  const segment = await loadSegmenter();
  const src = URL.createObjectURL(file);
  try {
    const noBg = await (await segment(src)).toBlob("image/png");
    const base = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
    const result = await trimTransparent(noBg, `${base}-cutout.png`);
    console.info("[wine_image_cutout_v1] done", { model: CUTOUT_MODEL, ms: Math.round(performance.now() - started), bytes: result.size });
    return result;
  } finally {
    URL.revokeObjectURL(src);
  }
}
