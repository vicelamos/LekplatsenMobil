// utils/imageCompression.js
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Komprimerar bilden och strippar EXIF-data genom att omkoda via expo-image-manipulator.
 * @param {string} uri - Bild-URI att bearbeta
 * @param {object} options - { quality: 0-1 }
 * @returns {Promise<string>} Ny URI utan EXIF-data
 */
export async function compressImage(uri, options = {}) {
  const result = await manipulateAsync(uri, [], {
    compress: options.quality || 0.75,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

/**
 * Beräknar ungefärlig filstorlek från base64-sträng.
 * @param {string} base64
 * @returns {string} t.ex. "2.50 MB" eller "512.00 KB"
 */
export function getReadableFileSize(base64) {
  const bytes = (base64.length * 3) / 4;
  const mb = bytes / (1024 * 1024);
  if (mb > 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(2)} KB`;
}
