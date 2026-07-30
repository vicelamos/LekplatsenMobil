import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { buildCheckinDoc } from '../../utils/checkinDocument';

/**
 * Skapar en incheckning.
 *
 * OBS: tidsstämpeln heter `timestamp`. Den här filen skrev tidigare `skapad`,
 * vilket gjorde att incheckningar skapade härifrån aldrig syntes i flödet —
 * det sorterar och paginerar på `timestamp`.
 */
export async function createCheckin(args) {
  const dokument = buildCheckinDoc(args);
  return addDoc(collection(db, 'incheckningar'), {
    ...dokument,
    timestamp: serverTimestamp(),
  });
}

/**
 * Snabbincheckning: bara betyg och lekplats.
 *
 * Detta är appens vanligaste handling — allt annat (bild, kommentar,
 * aktiviteter, taggade vänner) läggs till efteråt via updateCheckin.
 */
export async function createQuickCheckin({
  playgroundId, playgroundName, rating, userId, userSmeknamn, isGuest = false,
}) {
  return createCheckin({
    playgroundId, playgroundName, rating, userId, userSmeknamn, isGuest,
  });
}

/** Uppdaterar en incheckning (bara ägaren, se firestore.rules). */
export async function updateCheckin(checkinId, data) {
  return updateDoc(doc(db, 'incheckningar', checkinId), {
    ...data,
    redigerad: true,
    redigeradAt: serverTimestamp(),
  });
}

/**
 * Togglar like. Använder arrayUnion/arrayRemove i stället för att läsa
 * dokumentet först — en läsning mindre, och ingen kapplöpning mellan
 * läsning och skrivning.
 */
export async function toggleLike(checkinId, userId, isLiked) {
  return updateDoc(doc(db, 'incheckningar', checkinId), {
    likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
  });
}

/** Incheckningar för en lekplats, nyast först. */
export async function getCheckinsByPlayground(playgroundId, limitCount = 20) {
  const snap = await getDocs(query(
    collection(db, 'incheckningar'),
    where('lekplatsId', '==', playgroundId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Incheckningar för en användare, nyast först. */
export async function getCheckinsByUser(userId, limitCount = 50) {
  const snap = await getDocs(query(
    collection(db, 'incheckningar'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
