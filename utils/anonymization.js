/**
 * Ren logik för att anonymisera innehåll efter att ett konto raderats.
 *
 * Ingen Firestore-import: den här filen ska gå att testa utan emulator, och
 * den används både av appen (sökvägsbygget) och av molnfunktionen
 * anonymizeDeletedUser.
 */

/**
 * Ersätter userId på innehåll vars ägare raderat sitt konto. Alla raderade
 * användare delar samma värde med flit — det gör innehållet olänkbart, till
 * skillnad från ett kvarvarande UID.
 *
 * Måste vara en icke-tom sträng: appen gör getDoc(doc(db, 'users', userId))
 * och en tom sträng ger en ogiltig dokumentsökväg.
 */
export const ANONYMIZED_USER_ID = 'anonymiserad';

/** Visas i flödet i stället för smeknamnet. */
export const ANONYMIZED_DISPLAY_NAME = 'Borttagen användare';

/**
 * Sökvägen dit incheckningsbilder laddas upp.
 *
 * Medvetet UTAN användarens UID. Sökvägen hamnar i den publika bildUrl:en, och
 * ett UID där gör bilden spårbar tillbaka till personen även efter att kontot
 * anonymiserats. Ägarskapet kontrolleras i stället mot incheckningsdokumentet
 * i storage.rules.
 */
export function checkinImagePath(checkinId, fileName) {
  return `images/checkins/${checkinId}/${fileName}`;
}

const DOWNLOAD_URL_PREFIX = 'https://firebasestorage.googleapis.com/';

/**
 * Plockar ut lagringssökvägen ur en Firebase-nedladdnings-URL.
 * Returnerar null om det inte är en sådan URL.
 */
export function storagePathFromDownloadUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith(DOWNLOAD_URL_PREFIX)) return null;

  const marker = '/o/';
  const start = url.indexOf(marker);
  if (start === -1) return null;

  const rest = url.slice(start + marker.length);
  const encodedPath = rest.split('?')[0];
  if (!encodedPath) return null;

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

/**
 * Sant om sökvägen följer det gamla schemat med användarens UID i sig:
 *   images/checkins/{userId}/{checkinId}/{fil}   – fem segment
 * Det nya schemat har fyra:
 *   images/checkins/{checkinId}/{fil}
 */
export function isLegacyCheckinImagePath(path) {
  if (!path || typeof path !== 'string') return false;
  if (!path.startsWith('images/checkins/')) return false;
  return path.split('/').length === 5;
}

/**
 * Fälten som ska skrivas på en incheckning för att anonymisera den.
 * bildUrl nollas bara när bilden ligger på det gamla schemat — nya bilder
 * innehåller inget UID och kan ligga kvar.
 */
export function anonymizedCheckinFields(checkin = {}) {
  const fields = {
    userId: ANONYMIZED_USER_ID,
    userSmeknamn: ANONYMIZED_DISPLAY_NAME,
  };

  const path = storagePathFromDownloadUrl(checkin.bildUrl);
  if (isLegacyCheckinImagePath(path)) {
    fields.bildUrl = '';
  }

  return fields;
}
