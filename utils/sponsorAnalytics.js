import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Loggar en analytikshändelse för en sponsor.
 * Händelsetyper:
 *  - 'badgeImpressions'  – sponsorbadge visades
 *  - 'popupOpens'        – popup-rutan öppnades
 *  - 'hittaHitClicks'    – "Hitta hit" (Google Maps) klickades
 *  - 'websiteClicks'     – länk till hemsida klickades
 */
export async function trackSponsorEvent(sponsorId, eventType) {
  if (!sponsorId || !eventType) return;
  const today = new Date().toISOString().split('T')[0]; // "2026-03-21"
  const statsRef = doc(db, 'sponsors', sponsorId, 'stats', today);
  try {
    await setDoc(
      statsRef,
      { date: today, [eventType]: increment(1) },
      { merge: true }
    );
  } catch (_) {
    // fail silently – analytics ska aldrig blockera UX
  }
}
