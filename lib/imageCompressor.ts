import { fitImageToBytes } from "./imageBudget";

/**
 * Image compression utility for converting images to WebP format
 * with a maximum file size of 100KB.
 */

/**
 * Compresses an image to WebP under `maxSizeKB` and returns it as a data URL.
 * WebP files already inside the budget are kept as-is (coord id image_budget_v1).
 */
export async function compressImageToWebP(file: File, maxSizeKB: number = 100): Promise<string> {
  const fitted = await fitImageToBytes(file, maxSizeKB * 1024, { maxEdge: 1200 });
  return fileToBase64(fitted);
}

/**
 * Converts a File to base64 string
 * @param file - The file to convert
 * @returns Base64 encoded string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Checks if a file is a valid image type
 * @param file - The file to check
 * @returns True if the file is a valid image
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  return validTypes.includes(file.type);
}

/**
 * Gets human-readable file size
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
