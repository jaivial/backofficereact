/**
 * Document conversion utility for special menus
 * Handles conversion of PDF, Word, and TXT files to images for upload to Bunny CDN
 */

import { compressImageToWebP } from "./imageCompressor";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Supported file types for special menu images
 */
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

/**
 * Check if a file is a valid type for special menu upload
 */
export function isValidMenuFileType(file: File): boolean {
  return SUPPORTED_MENU_FILE_TYPES.includes(file.type as SupportedMenuFileType);
}

/**
 * Check if a file needs conversion (PDF, Word, TXT)
 * These files need server-side processing
 */
export function fileNeedsConversion(file: File): boolean {
  const conversionTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];
  return conversionTypes.includes(file.type);
}

/**
 * Process a file for special menu upload
 * - For images: compress to WebP if needed
 * - For PDF/Word/TXT: return as-is for server-side conversion
 *
 * @param file - The file to process
 * @returns Processed file ready for upload
 */
export async function processSpecialMenuFile(file: File): Promise<{ file: File; needsServerConversion: boolean }> {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB}MB`);
  }

  // For images, compress if needed
  if (file.type.startsWith("image/") && !file.type.includes("webp")) {
    try {
      const compressedBase64 = await compressImageToWebP(file, 500); // 500KB for menu images
      // Convert base64 back to File
      const response = await fetch(compressedBase64);
      const blob = await response.blob();
      const processedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
      return { file: processedFile, needsServerConversion: false };
    } catch {
      // If compression fails, return original
      return { file, needsServerConversion: false };
    }
  }

  // For images that are already WebP or don't need conversion
  if (file.type.startsWith("image/")) {
    return { file, needsServerConversion: false };
  }

  // For PDF, Word, TXT - needs server-side conversion
  return { file, needsServerConversion: true };
}

/**
 * Get file extension from MIME type
 */
export function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
  };
  return extensions[mimeType] || "bin";
}

/**
 * Generate a unique filename for the special menu image
 */
export function generateSpecialMenuFileName(menuId: number, originalFileName: string): string {
  const extension = getFileExtension(originalFileName);
  const timestamp = Date.now();
  return `menu-special-${menuId}-${timestamp}.${extension}`;
}
