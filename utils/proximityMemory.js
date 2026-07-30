/**
 * Kommer ihåg vilka lekplatser närhetsprompten inte ska fråga om just nu.
 *
 * Tidsgränser i stället för dygnsgränser med flit: avfärdar man en lekplats
 * 23:50 vill man inte få tillbaka frågan 00:01. Ren logik, ingen lagring —
 * persistensen ligger i src/services/proximityMemoryStore.js.
 */

/** Avfärdad lekplats lämnas ifred i sex timmar. */
export const DISMISS_TTL_MS = 6 * 60 * 60 * 1000;

/** Redan betygsatt lekplats frågas inte om igen på ett dygn. */
export const RATED_TTL_MS = 24 * 60 * 60 * 1000;

const TTL = {
  dismissed: DISMISS_TTL_MS,
  rated: RATED_TTL_MS,
};

/** Sant om posten fortfarande gäller. */
function stillActive(entry, now) {
  if (!entry || typeof entry.at !== 'number') return false;
  const ttl = TTL[entry.kind];
  if (!ttl) return false;
  return now - entry.at < ttl;
}

/**
 * @param {object} memory
 * @param {string} playgroundId
 * @param {'dismissed'|'rated'} kind
 * @param {number} now
 * @returns {object} nytt minne
 */
export function remember(memory = {}, playgroundId, kind, now = Date.now()) {
  if (!playgroundId) return { ...memory };
  return { ...memory, [playgroundId]: { kind, at: now } };
}

/** Lekplats-id:n som inte ska föreslås just nu. */
export function activeExclusions(memory = {}, now = Date.now()) {
  return Object.entries(memory || {})
    .filter(([, entry]) => stillActive(entry, now))
    .map(([id]) => id);
}

/** Minnet utan utgångna poster – kör före sparning så det inte växer. */
export function prune(memory = {}, now = Date.now()) {
  const kvar = {};
  for (const [id, entry] of Object.entries(memory || {})) {
    if (stillActive(entry, now)) kvar[id] = entry;
  }
  return kvar;
}
