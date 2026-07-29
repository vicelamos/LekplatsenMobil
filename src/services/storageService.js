import { ref, getDownloadURL } from 'firebase/storage';
import { File as ExpoFile } from 'expo-file-system';
import { auth, storage } from '../../firebase';
import { compressImage } from '../../utils/imageCompression';
import { storageUploadUrl } from '../../utils/storagePaths';

/**
 * Laddar upp base64-data till en Storage-referens.
 *
 * Det här är den enda kopian av uppladdningslogiken. Tidigare hade fem skärmar
 * varsin identisk kopia, och tre av dem hårdkodade produktions-bucketen — så
 * profilbilder, lekplatsbilder och sponsorloggor från en dev-build hamnade i
 * produktion. Bucketen kommer nu alltid från referensen.
 *
 * @param {import('firebase/storage').StorageReference} storageRef
 * @param {string} base64Data
 * @returns {Promise<void>}
 */
export async function uploadBase64(storageRef, base64Data) {
  const url = storageUploadUrl(storageRef);
  const token = await auth.currentUser?.getIdToken();

  const binaryStr = atob(base64Data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Upload XHR error'));
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'image/jpeg');
    xhr.setRequestHeader('X-Goog-Upload-Protocol', 'raw');
    if (token) xhr.setRequestHeader('Authorization', `Firebase ${token}`);
    xhr.send(bytes);
  });
}

/**
 * Komprimerar, strippar EXIF och laddar upp en bild.
 *
 * @param {string} uri - Lokal bild-URI
 * @param {string} storagePath - Sökväg i Storage
 * @param {object} options - { quality: 0.75 }
 * @returns {Promise<string>} Nedladdnings-URL
 */
export async function uploadImage(uri, storagePath, options = {}) {
  const compressedUri = await compressImage(uri, { quality: options.quality || 0.75 });
  const file = new ExpoFile(compressedUri);
  const base64Data = await file.base64();

  const storageRef = ref(storage, storagePath);
  await uploadBase64(storageRef, base64Data);
  return getDownloadURL(storageRef);
}
