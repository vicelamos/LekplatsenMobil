/**
 * Ren logik för att avgöra vilka sponsorvisningar som ska räknas.
 *
 * Ingen Firestore-import med flit — den här filen ska gå att testa utan
 * emulator eller mockar. Skrivningen sker i src/hooks/useSponsorImpressions.js.
 */

/**
 * Datumnyckeln som statistiken bokförs på — samma sträng som används till
 * dokument-id:t i sponsors/{id}/stats/{datum}. UTC, inte lokal tid, så att
 * räknaren och dokumentet aldrig kan hamna på olika dygn.
 */
export function statsDateKey(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/** Sant om lekplatsen har en aktiv guldsponsring, dvs. visar en badge. */
export function isGoldSponsor(playground) {
  return Boolean(
    playground?.sponsorship?.active && playground?.sponsorship?.level === 'guld'
  );
}

/**
 * Plockar ut sponsor-id:n ur FlatLists `viewableItems`.
 * Samma sponsor kan ligga på flera lekplatser i vyn — den returneras en gång.
 */
export function sponsorIdsFromViewableItems(viewableItems = []) {
  const ids = [];
  const seen = new Set();

  for (const entry of viewableItems) {
    const item = entry?.item;
    if (!isGoldSponsor(item)) continue;

    const sponsorId = item?.sponsorData?.id;
    if (!sponsorId || seen.has(sponsorId)) continue;

    seen.add(sponsorId);
    ids.push(sponsorId);
  }

  return ids;
}

/**
 * Håller reda på vilka sponsorer som redan räknats, så att samma badge inte
 * loggas om när listan återanvänder kort vid scroll eller när en skärm
 * renderas om.
 *
 * Räknaren nollställs vid dygnsbyte. Statistiken bokförs per datum, och en app
 * som ligger kvar i bakgrunden i flera dygn skulle annars ge noll visningar
 * varje dag efter den första.
 *
 * `dateKey` går att injicera i tester för att simulera ett dygnsbyte.
 */
export function createSessionImpressionTracker({ dateKey = statsDateKey } = {}) {
  const counted = new Set();
  let currentDay = dateKey();

  // Nollställer om vi passerat midnatt sedan senaste anropet.
  const syncDay = () => {
    const day = dateKey();
    if (day !== currentDay) {
      counted.clear();
      currentDay = day;
    }
  };

  return {
    /**
     * Tar emot sponsorer som just blivit synliga och returnerar dem som ska
     * loggas — alltså de som inte redan räknats i dag. Markerar dem som räknade.
     */
    take(sponsorIds = []) {
      syncDay();
      const fresh = [];
      for (const id of sponsorIds) {
        if (!id || counted.has(id)) continue;
        counted.add(id);
        fresh.push(id);
      }
      return fresh;
    },

    hasCounted(sponsorId) {
      syncDay();
      return counted.has(sponsorId);
    },

    reset() {
      counted.clear();
      currentDay = dateKey();
    },

    get size() {
      syncDay();
      return counted.size;
    },
  };
}
