/**
 * File utilities for special menu upload.
 *
 * - Accepts images, PDF, Word and TXT inputs.
 * - Image inputs are normalized to WEBP <= 150KB in frontend when possible.
 * - Document inputs are sent as-is and converted server-side.
 */

import { compressImageToWebP } from "./imageCompressor";

export const SPECIAL_MENU_MAX_FILE_MB = 10;
export const SPECIAL_MENU_MAX_FILE_BYTES = SPECIAL_MENU_MAX_FILE_MB * 1024 * 1024;
export const SPECIAL_MENU_MAX_WEBP_KB = 150;

export const SUPPORTED_MENU_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export type SupportedMenuFileType = (typeof SUPPORTED_MENU_FILE_TYPES)[number];

export function isValidMenuFileType(file: File): boolean {
  return SUPPORTED_MENU_FILE_TYPES.includes(file.type as SupportedMenuFileType);
}

export function fileNeedsServerConversion(file: File): boolean {
  const conversionTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];
  return conversionTypes.includes(file.type);
}

async function dataURLToFile(dataUrl: string, outputName: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], outputName, { type: "image/webp" });
}

function outputWebPName(fileName: string): string {
  const base = String(fileName || "menu-especial").replace(/\.[^.]+$/, "").trim() || "menu-especial";
  return `${base.replace(/\s+/g, "-")}.webp`;
}

export async function processSpecialMenuFile(file: File): Promise<{ file: File; needsServerConversion: boolean }> {
  if (file.size > SPECIAL_MENU_MAX_FILE_BYTES) {
    throw new Error(`El archivo excede el tamaño máximo de ${SPECIAL_MENU_MAX_FILE_MB}MB`);
  }

  if (!isValidMenuFileType(file)) {
    throw new Error("Formato no soportado. Usa imagen, PDF, Word o TXT");
  }

  if (fileNeedsServerConversion(file)) {
    return { file, needsServerConversion: true };
  }

  const alreadyWebP = file.type === "image/webp";
  if (alreadyWebP && file.size <= SPECIAL_MENU_MAX_WEBP_KB * 1024) {
    return { file, needsServerConversion: false };
  }

  const compressed = await compressImageToWebP(file, SPECIAL_MENU_MAX_WEBP_KB);
  const webpFile = await dataURLToFile(compressed, outputWebPName(file.name));
  if (webpFile.size > SPECIAL_MENU_MAX_WEBP_KB * 1024) {
    throw new Error("No se pudo reducir la imagen por debajo de 150KB");
  }

  return { file: webpFile, needsServerConversion: false };
}

export function formatFileSizeKB(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
