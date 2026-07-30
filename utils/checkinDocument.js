/**
 * Bygger incheckningsdokumentet.
 *
 * Formen är ett kontrakt mot flera saker som inte kollar om fälten finns:
 * molnfunktionerna `updateUserAndPlaygroundStats`, `onCheckinLike` och
 * `updateCommentCount`, flödet i HomeScreen, samt firestore.rules som listar
 * vilka fält ägaren får redigera. Därför byggs dokumentet på ett ställe.
 */

/** Fält som måste finnas på varje incheckning. */
export const CHECKIN_REQUIRED_FIELDS = [
  'betyg',
  'bildUrl',
  'commentCount',
  'gjordaAktiviteter',
  'klaradeUtmaningar',
  'kommentar',
  'lekplatsId',
  'lekplatsNamn',
  'likes',
  'taggadeVanner',
  'tidPaLekplats',
  'userId',
  'userSmeknamn',
];

/**
 * @param {object} args
 * @param {string} args.playgroundId
 * @param {string} [args.playgroundName]
 * @param {number|string} args.rating - 1-5
 * @param {string} args.userId
 * @param {string} [args.userSmeknamn]
 * @param {boolean} [args.isGuest]
 * @returns {object} dokument utan `timestamp` — den sätts av servern
 */
export function buildCheckinDoc({
  playgroundId,
  playgroundName = '',
  rating,
  userId,
  userSmeknamn = '',
  isGuest = false,
  kommentar = '',
  bildUrl = '',
  gjordaAktiviteter = [],
  klaradeUtmaningar = [],
  taggadeVanner = [],
  tidPaLekplats = '',
} = {}) {
  if (!playgroundId) {
    throw new Error('buildCheckinDoc: lekplats saknas');
  }
  if (!userId) {
    throw new Error('buildCheckinDoc: användare saknas');
  }

  const betyg = Number(rating);
  if (!Number.isFinite(betyg) || betyg < 1 || betyg > 5) {
    throw new Error('buildCheckinDoc: betyg måste vara 1-5');
  }

  // Gäster har varken vänner eller utmaningsframsteg att registrera.
  const socialt = isGuest
    ? { gjordaAktiviteter: [], klaradeUtmaningar: [], taggadeVanner: [] }
    : { gjordaAktiviteter, klaradeUtmaningar, taggadeVanner };

  return {
    betyg,
    bildUrl,
    commentCount: 0,
    kommentar: (kommentar || '').trim(),
    lekplatsId: playgroundId,
    lekplatsNamn: playgroundName || '',
    likes: [],
    tidPaLekplats: isGuest ? '' : (tidPaLekplats || '').toString().trim(),
    userId,
    userSmeknamn: userSmeknamn || '',
    ...socialt,
    ...(isGuest ? { isGuest: true } : {}),
  };
}
