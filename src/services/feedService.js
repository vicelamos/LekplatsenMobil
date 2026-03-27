import { doc, getDoc, getDocs, collection, query, where, orderBy, limit } from 'firebase/firestore';
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

const FALLBACK_IMG =
  'https://firebasestorage.googleapis.com/v0/b/lekplatsen-907fb.firebasestorage.app/o/bild%20saknas.png?alt=media&token=3acbfa69-dea8-456b-bbe2-dd95034f773f';

/**
 * Returnerar en bild-URL för en lekplats.
 * Om lekplatsen saknar egen bild (eller bara har standardbilden), hämtas
 * den senaste incheckningen med bild i stället.
 * Faller slutligen tillbaka på FALLBACK_IMG.
 */
export const getPlaygroundImage = async (playground) => {
  const ownImage = playground?.bildUrl || playground?.imageUrl || '';
  const isMissingImage =
    !ownImage || ownImage.includes('bild%20saknas') || ownImage.includes('bild saknas');

  if (!isMissingImage) return ownImage;

  // Försök hämta bild från senaste incheckning med bild
  const pgId = playground?.id;
  if (!pgId) return FALLBACK_IMG;

  try {
    const q = query(
      collection(db, 'incheckningar'),
      where('lekplatsId', '==', pgId),
      limit(10)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const bildUrl = d.data().bildUrl;
      if (bildUrl && bildUrl.trim() !== '') {
        return bildUrl;
      }
    }
  } catch (e) {
    console.warn('getPlaygroundImage: kunde inte hämta incheckningar', e);
  }

  return FALLBACK_IMG;
};

/**
 * Berikar en lista med lekplatser med rätt bild-URL.
 * Anropar getPlaygroundImage för varje lekplats parallellt.
 */
export const enrichPlaygroundsWithImages = async (playgrounds) => {
  if (!playgrounds || playgrounds.length === 0) return playgrounds;
  const withImages = await Promise.all(
    playgrounds.map(async (pg) => {
      const resolvedImage = await getPlaygroundImage(pg);
      return { ...pg, resolvedImageUrl: resolvedImage };
    })
  );
  return withImages;
};