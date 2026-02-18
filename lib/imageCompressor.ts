/**
 * Image compression utility for converting images to WebP format
 * with a maximum file size of 100KB.
 */

/**
 * Compresses an image to WebP format with target max size of 100KB
 * @param file - The original image file
 * @param maxSizeKB - Maximum target size in KB (default: 100)
 * @returns Base64 encoded WebP image string
 */
export async function compressImageToWebP(file: File, maxSizeKB: number = 100): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    img.onload = () => {
      // Start with original dimensions
      let width = img.width;
      let height = img.height;

      // Calculate initial dimensions maintaining aspect ratio
      const maxDimension = 1200;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw image with smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels to get under max size
      let quality = 0.92;
      const minQuality = 0.5;
      const targetSize = maxSizeKB * 1024;

      const tryCompress = (): void => {
        const dataUrl = canvas.toDataURL("image/webp", quality);

        // Check size
        const base64 = dataUrl.split(",")[1];
        const size = Math.round((base64.length * 3) / 4);

        if (size <= targetSize || quality <= minQuality) {
          resolve(dataUrl);
        } else {
          // Reduce quality and try again
          quality -= 0.1;
          if (quality < minQuality) {
            // If still too large, reduce dimensions
            width = Math.round(width * 0.8);
            height = Math.round(height * 0.8);
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            quality = 0.92;
          }
          tryCompress();
        }
      };

      tryCompress();
    };

    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    img.src = URL.createObjectURL(file);
  });
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
