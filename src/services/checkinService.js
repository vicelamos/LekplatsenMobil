import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../../firebase';

/**
 * Skapar en ny incheckning.
 */
export async function createCheckin(data) {
  return addDoc(collection(db, 'incheckningar'), {
    ...data,
    skapad: serverTimestamp(),
    likes: [],
  });
}

/**
 * Uppdaterar en incheckning (ägaren).
 */
export async function updateCheckin(checkinId, data) {
  return updateDoc(doc(db, 'incheckningar', checkinId), {
    ...data,
    redigerad: true,
    redigeradAt: serverTimestamp(),
  });
}

/**
 * Togglar like på en incheckning.
 */
export async function toggleLike(checkinId, userId) {
  const ref = doc(db, 'incheckningar', checkinId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const likes = snap.data().likes || [];
  if (likes.includes(userId)) {
    await updateDoc(ref, { likes: arrayRemove(userId) });
  } else {
    await updateDoc(ref, { likes: arrayUnion(userId) });
  }
}

/**
 * Hämtar incheckningar för en specifik lekplats.
 */
export async function getCheckinsByPlayground(playgroundId, limitCount = 20) {
  const q = query(
    collection(db, 'incheckningar'),
    where('lekplatsId', '==', playgroundId),
    orderBy('skapad', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Hämtar incheckningar för en specifik användare.
 */
export async function getCheckinsByUser(userId, limitCount = 50) {
  const q = query(
    collection(db, 'incheckningar'),
    where('userId', '==', userId),
    orderBy('skapad', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
