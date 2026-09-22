import { fitImageToBytes } from "../../lib/imageBudget";

function baseName(fileName: string): string {
  const n = String(fileName || "avatar").trim();
  const dot = n.lastIndexOf(".");
  const raw = dot > 0 ? n.slice(0, dot) : n;
  return raw || "avatar";
}

function assertImageInput(file: File): void {
  if (!file || !file.type.startsWith("image/")) throw new Error("Selecciona un archivo de imagen");
  if (file.size > 15 * 1024 * 1024) throw new Error("La imagen es demasiado grande (max 15MB)");
}

export async function imageToWebpMax200KB(file: File): Promise<File> {
  assertImageInput(file);
  return fitImageToBytes(file, 200 * 1024, { maxEdge: 1400, name: `${baseName(file.name)}.webp` });
}

export async function imageToWebpMax50KB(file: File): Promise<File> {
  assertImageInput(file);
  return fitImageToBytes(file, 50 * 1024, { maxEdge: 800, name: `${baseName(file.name)}.webp` });
}

/** Base64 for socket uploads (coordination id: special_menu_sections_image_state_v1). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Keeps any file that already fits `maxBytes` (whatever its type); larger ones
 * are re-encoded to WebP. Coordination id: special_menu_sections_image_state_v1
 */
export function imageUnderBytes(file: File, maxBytes: number): Promise<File> {
  return fitImageToBytes(file, maxBytes, { keepTypes: [file.type] });
}
