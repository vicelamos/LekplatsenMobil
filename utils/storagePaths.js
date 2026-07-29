/**
 * Ren logik för Firebase Storage-URL:er. Ingen firebase-import, så den går
 * att testa utan att initiera en app.
 */

const STORAGE_HOST = 'https://firebasestorage.googleapis.com';

/**
 * Bygger uppladdnings-URL:en för en Storage-referens.
 *
 * Bucketen tas ALLTID från referensen. Tidigare hade flera skärmar sin egen
 * kopia av den här logiken där bucketen var hårdkodad till produktions-
 * projektet, vilket gjorde att uppladdningar från en dev-build hamnade i
 * produktion. Referensen känner till rätt bucket — hårdkoda den aldrig.
 *
 * @param {{bucket: string, fullPath: string}} storageRef
 * @returns {string}
 */
export function storageUploadUrl(storageRef) {
  if (!storageRef || !storageRef.bucket) {
    throw new Error('storageUploadUrl: storageRef saknar bucket');
  }
  if (!storageRef.fullPath) {
    throw new Error('storageUploadUrl: storageRef saknar fullPath');
  }

  const encodedPath = encodeURIComponent(storageRef.fullPath);
  return `${STORAGE_HOST}/v0/b/${storageRef.bucket}/o/${encodedPath}`;
}
