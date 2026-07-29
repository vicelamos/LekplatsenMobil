import {
  collection, doc, getDoc, getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { joinSponsorData } from '../../utils/playgroundSponsors';

/**
 * Lekplatser och sponsorer läses i sin helhet — det finns ingen geoindexering
 * ännu, så kartan och sökningen behöver hela underlaget. Kostnaden är alltså
 * en läsning per lekplats OCH per sponsor, vid varje anrop.
 *
 * Både HomeScreen och SearchScreen hämtar detta via `useFocusEffect`, alltså
 * om vid varje flikbyte. Utan cache betalar man hela summan varje gång.
 * Lekplatsdata ändras sällan och är admin-kurerad, så en kort cache är
 * ofarlig — och skärmarna som ändrar data anropar invalidatePlaygroundCache().
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null; // { at: number, playgrounds: object[] }

/** Tömmer cachen. Anropas när lekplats- eller sponsordata ändrats. */
export function invalidatePlaygroundCache() {
  cache = null;
}

/**
 * Alla lekplatser med påkopplad sponsordata.
 *
 * @param {object} [options]
 * @param {boolean} [options.force] - hoppa över cachen
 * @param {() => number} [options.now] - injicerbar klocka för tester
 */
export async function getPlaygroundsWithSponsors({ force = false, now = Date.now } = {}) {
  if (!force && cache && now() - cache.at < CACHE_TTL_MS) {
    return cache.playgrounds;
  }

  const [pgSnap, sponsorSnap] = await Promise.all([
    getDocs(collection(db, 'lekplatser')),
    getDocs(collection(db, 'sponsors')),
  ]);

  const playgrounds = joinSponsorData(
    pgSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    sponsorSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  );

  cache = { at: now(), playgrounds };
  return playgrounds;
}

/** Hämtar en specifik lekplats. */
export async function getPlayground(id) {
  const snap = await getDoc(doc(db, 'lekplatser', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Skapar ett ändringsförslag för en lekplats. */
export async function createSuggestion(data) {
  return addDoc(collection(db, 'andringsforslag'), {
    ...data,
    skapad: serverTimestamp(),
  });
}

/** Skapar en ny lekplats (utkast för granskning). */
export async function submitPlayground(data) {
  invalidatePlaygroundCache();
  return addDoc(collection(db, 'lekplatser'), {
    ...data,
    skapad: serverTimestamp(),
  });
}
