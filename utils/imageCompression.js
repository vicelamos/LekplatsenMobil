// utils/imageCompression.js
// Ingen native modul behövs – komprimering hanteras av expo-image-picker via quality-parametern.

/**
 * Returnerar URI:n som den är.
 * Komprimering sker redan i expo-image-picker när quality: 0.75 anges.
 * Funktionen finns kvar så att all anropande kod fungerar utan ändringar.
 */
export async function compressImage(uri, _options = {}) {
  return uri;
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