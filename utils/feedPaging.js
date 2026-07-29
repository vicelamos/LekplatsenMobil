/**
 * Ren logik för vänflödets paginering.
 *
 * Flödet hämtas med `where('userId', 'in', [...])`, och Firestore tar max 30
 * värden per sådan fråga. Vänlistan delas därför upp i chunkar som frågas var
 * för sig och slås ihop i klienten.
 *
 * Det knepiga är markörerna. Varje chunk hämtar en hel sida, men bara de
 * nyaste posterna av alla chunkar visas. De som sorteras bort måste komma med
 * nästa gång — därför har varje chunk en EGEN markör som bara flyttas fram
 * till den sista post från just den chunken som faktiskt kom med på sidan.
 * En gemensam markör (som tidigare) hoppar över de bortsorterade posterna
 * permanent.
 */

/** Firestores maxantal värden i en `in`-fråga. */
export const IN_QUERY_MAX = 30;

/**
 * Delar upp id:n i chunkar som ryms i en `in`-fråga.
 * Dubbletter tas bort, ordningen bevaras — markörer per chunk förutsätter
 * att samma indata alltid ger samma chunkindelning.
 */
export function chunkIds(ids = [], size = IN_QUERY_MAX) {
  const unika = [...new Set(ids)];
  const chunkar = [];
  for (let i = 0; i < unika.length; i += size) {
    chunkar.push(unika.slice(i, i + size));
  }
  return chunkar;
}

/** Millisekunder för sortering. Saknad tidsstämpel sorteras sist. */
function toMillis(item) {
  const ts = item?.timestamp;
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

/**
 * Slår ihop en sida från varje chunk till en gemensam sida.
 *
 * @param {Array<Array<object>>} chunkPages - resultat per chunk, nyast först
 * @param {number} pageSize
 * @returns {{page: object[], cursors: Array<object|null>, hasMore: boolean}}
 *   `cursors[i]` är sista posten från chunk i som kom med på sidan, eller null
 *   om ingen gjorde det (då ska chunkens tidigare markör behållas).
 */
export function mergeChunkPages(chunkPages = [], pageSize = 10) {
  const alla = [];
  const sedda = new Set();

  chunkPages.forEach((poster, chunkIndex) => {
    for (const item of poster || []) {
      if (!item || sedda.has(item.id)) continue;
      sedda.add(item.id);
      alla.push({ item, chunkIndex, millis: toMillis(item) });
    }
  });

  alla.sort((a, b) => b.millis - a.millis);

  const medtagna = alla.slice(0, pageSize);
  const cursors = chunkPages.map(() => null);
  for (const { item, chunkIndex } of medtagna) {
    cursors[chunkIndex] = item;
  }

  const kapades = alla.length > medtagna.length;
  const nagonChunkFull = chunkPages.some((p) => (p || []).length >= pageSize);

  return {
    page: medtagna.map((m) => m.item),
    cursors,
    hasMore: kapades || nagonChunkFull,
  };
}
