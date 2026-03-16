import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

/**
 * Berikar incheckningsdata med användarprofiler och lekplatsinfo.
 * Omvandlar även taggade vänners ID:n till smeknamn.
 */
export const enrichFeed = async (checkInsData) => {
  if (!checkInsData || checkInsData.length === 0) return [];

  // 1. Samla alla unika User-ID:n (både den som checkat in och taggade vänner)
  const userIdsToFetch = new Set(checkInsData.map((c) => c.userId));
  checkInsData.forEach((c) => {
    if (Array.isArray(c.taggadeVanner)) {
      c.taggadeVanner.forEach((id) => userIdsToFetch.add(id));
    }
  });

  // 2. Hämta alla användarprofiler parallellt
  const userSnaps = await Promise.all(
    [...userIdsToFetch].map((id) => getDoc(doc(db, 'users', id)))
  );
  const usersMap = {};
  userSnaps.forEach((snap) => {
    if (snap.exists()) usersMap[snap.id] = snap.data();
  });

  // 3. Samla alla unika lekplats-ID:n och hämta dem
  const playgroundIdsToFetch = [...new Set(checkInsData.map((c) => c.lekplatsId))];
  const pgSnaps = await Promise.all(
    playgroundIdsToFetch.map((id) => getDoc(doc(db, 'lekplatser', id)))
  );
  const pgsMap = {};
  pgSnaps.forEach((snap) => {
    if (snap.exists()) pgsMap[snap.id] = { id: snap.id, ...snap.data() };
  });

  // 4. Sätt ihop allt till ett färdigt paket
  return checkInsData.map((incheckning) => {
    const vannerNamn = (incheckning.taggadeVanner || []).map(
      (id) => usersMap[id]?.smeknamn || 'Okänd kompis'
    );

    return {
      id: incheckning.id,
      incheckning: { 
        ...incheckning, 
        taggadeVanner: vannerNamn 
      },
      user: usersMap[incheckning.userId],
      lekplats: pgsMap[incheckning.lekplatsId],
    };
  });
};