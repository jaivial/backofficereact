import { fitImageToBytes } from "./imageBudget";

/**
 * Global frontend rule for image uploads (pedido de Jaime, 2026-10-09):
 * every image that leaves the frontend goes out as WebP and at most 2MB.
 * A WebP that already fits is sent untouched; any other image is re-encoded
 * to WebP under the budget. Non-image files (PDF, sheets, ...) pass through
 * unchanged.
 */
export const IMAGE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

export function isImageFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File && value.type.startsWith("image/");
}

export async function prepareImageForUpload(file: File): Promise<File> {
  if (!isImageFile(file)) return file;
  return fitImageToBytes(file, IMAGE_UPLOAD_MAX_BYTES, {
    type: "image/webp",
    keepTypes: ["image/webp"],
    maxEdge: 2560,
  });
}

/**
 * Returns `form` untouched when it carries no images; otherwise a copy with
 * every image File replaced by its prepared (<=2MB WebP) version.
 */
export async function prepareFormImages(form: FormData): Promise<FormData> {
  const entries = Array.from(form.entries());
  if (!entries.some(([, value]) => isImageFile(value))) return form;
  const next = new FormData();
  for (const [key, value] of entries) {
    next.append(key, isImageFile(value) ? await prepareImageForUpload(value) : value);
  }
  return next;
}
