import { doc, setDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { statsDateKey } from './sponsorImpressions';

/**
 * Händelsetyper som får loggas. Listan speglar räknarna i firestore.rules —
 * skrivningar med andra fältnamn nekas av reglerna, så de måste hållas i synk.
 */
export const SPONSOR_EVENT_TYPES = [
  'badgeImpressions', // sponsorbadge visades
  'popupOpens',       // popup-rutan öppnades
  'hittaHitClicks',   // "Hitta hit" (Google Maps) klickades
  'websiteClicks',    // länk till hemsida klickades
];

/**
 * Loggar en analytikshändelse för en sponsor.
 */
export async function trackSponsorEvent(sponsorId, eventType) {
  if (!sponsorId || !eventType) return;
  if (!SPONSOR_EVENT_TYPES.includes(eventType)) {
    // Skulle ändå nekas av reglerna – men tyst. Säg till i utvecklingsläge.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn(`trackSponsorEvent: okänd händelsetyp "${eventType}"`);
    }
    return;
  }
  // Samma dygnsdefinition som sessionsräknaren använder – annars kan räknaren
  // tro att sponsorn redan loggats i dag medan skrivningen går till nästa dygn.
  const today = statsDateKey();
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
