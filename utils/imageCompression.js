// utils/imageCompression.js
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Komprimerar och skalar ner en bild för att minska filstorleken
 * @param {string} uri - URI till bilden
 * @param {Object} options - Konfiguration
 * @param {number} options.maxWidth - Max bredd i pixlar (default: 1200)
 * @param {number} options.maxHeight - Max höjd i pixlar (default: 1200)
 * @param {number} options.quality - Kompressionskvalitet 0-1 (default: 0.75)
 * @returns {Promise<string>} - URI till den komprimerade bilden
 */
export async function compressImage(uri, options = {}) {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.75,
  } = options;

  try {
    console.log('Komprimerar bild...', { uri, maxWidth, maxHeight, quality });
    
    const manipulatedImage = await ImageManipulator.manipulateAsync(
      uri,
      [
        { resize: { width: maxWidth, height: maxHeight } }, // Behåller aspect ratio
      ],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    console.log('Bild komprimerad:', {
      original: uri,
      compressed: manipulatedImage.uri,
      width: manipulatedImage.width,
      height: manipulatedImage.height,
    });

    return manipulatedImage.uri;
  } catch (error) {
    console.error('Fel vid bildkomprimering:', error);
    // Returnera original om komprimering misslyckas
    return uri;
  }
}

/**
 * Beräknar ungefärlig filstorlek från base64 sträng
 * @param {string} base64 - Base64 encoded data
 * @returns {string} - Läsbar filstorlek (t.ex. "2.5 MB")
 */
export function getReadableFileSize(base64) {
  const bytes = (base64.length * 3) / 4;
  const mb = bytes / (1024 * 1024);
  if (mb > 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(2)} KB`;
}
