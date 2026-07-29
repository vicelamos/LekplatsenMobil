import {
  IN_QUERY_MAX,
  chunkIds,
  mergeChunkPages,
} from '../../utils/feedPaging';

/** Efterliknar en incheckning med Firestore-Timestamp. */
const post = (id, millis) => ({ id, timestamp: { toMillis: () => millis } });

describe('chunkIds', () => {
  it('returnerar tom lista för tomt underlag', () => {
    expect(chunkIds([])).toEqual([]);
    expect(chunkIds()).toEqual([]);
  });

  it('lägger allt i en chunk när det får plats', () => {
    expect(chunkIds(['a', 'b', 'c'])).toEqual([['a', 'b', 'c']]);
  });

  it('delar på Firestores gräns för in-frågor', () => {
    const ids = Array.from({ length: 70 }, (_, i) => `u${i}`);
    const chunks = chunkIds(ids);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(IN_QUERY_MAX);
    expect(chunks[1]).toHaveLength(IN_QUERY_MAX);
    expect(chunks[2]).toHaveLength(70 - 2 * IN_QUERY_MAX);
  });

  it('gränsen är 30, inte 10', () => {
    expect(IN_QUERY_MAX).toBe(30);
    expect(chunkIds(Array.from({ length: 30 }, (_, i) => i))).toHaveLength(1);
  });

  it('tar bort dubbletter', () => {
    expect(chunkIds(['a', 'b', 'a'])).toEqual([['a', 'b']]);
  });

  it('är deterministisk – markörer per chunk kräver stabil ordning', () => {
    const ids = Array.from({ length: 45 }, (_, i) => `u${i}`);
    expect(chunkIds(ids)).toEqual(chunkIds(ids));
  });
});

describe('mergeChunkPages', () => {
  it('slår ihop och sorterar nyast först', () => {
    const { page } = mergeChunkPages([
      [post('a', 300), post('c', 100)],
      [post('b', 200)],
    ], 10);
    expect(page.map(p => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('kapar till sidstorleken', () => {
    const { page } = mergeChunkPages([
      [post('a', 500), post('b', 400), post('c', 300)],
    ], 2);
    expect(page.map(p => p.id)).toEqual(['a', 'b']);
  });

  /**
   * Kärnan i buggen: chunk 2 bidrar med poster som sorteras bort. Markören för
   * chunk 2 får INTE flyttas förbi dem, annars hämtas de aldrig igen.
   */
  it('flyttar bara markören för poster som kom med på sidan', () => {
    const { page, cursors } = mergeChunkPages([
      [post('a1', 900), post('a2', 800)],
      [post('b1', 300), post('b2', 200)],
    ], 2);

    expect(page.map(p => p.id)).toEqual(['a1', 'a2']);
    expect(cursors[0].id).toBe('a2');
    // Ingen post från chunk 2 kom med – markören ska stå kvar
    expect(cursors[1]).toBeNull();
  });

  it('sätter markören till sista medtagna posten per chunk', () => {
    const { page, cursors } = mergeChunkPages([
      [post('a1', 900), post('a2', 500)],
      [post('b1', 800), post('b2', 100)],
    ], 3);

    expect(page.map(p => p.id)).toEqual(['a1', 'b1', 'a2']);
    expect(cursors[0].id).toBe('a2');
    expect(cursors[1].id).toBe('b1');
  });

  it('rapporterar hasMore när poster kapades bort', () => {
    const { hasMore } = mergeChunkPages([
      [post('a', 300), post('b', 200), post('c', 100)],
    ], 2);
    expect(hasMore).toBe(true);
  });

  it('rapporterar hasMore när en chunk gav en full sida', () => {
    const { hasMore } = mergeChunkPages([[post('a', 300), post('b', 200)]], 2);
    expect(hasMore).toBe(true);
  });

  it('rapporterar inte hasMore när allt fick plats', () => {
    const { page, hasMore } = mergeChunkPages([
      [post('a', 300)],
      [post('b', 200)],
    ], 10);
    expect(page).toHaveLength(2);
    expect(hasMore).toBe(false);
  });

  it('tål tomma chunkar', () => {
    const { page, cursors, hasMore } = mergeChunkPages([[], [post('b', 100)], []], 5);
    expect(page.map(p => p.id)).toEqual(['b']);
    expect(cursors[0]).toBeNull();
    expect(cursors[1].id).toBe('b');
    expect(cursors[2]).toBeNull();
    expect(hasMore).toBe(false);
  });

  it('tål helt tomt underlag', () => {
    const { page, cursors, hasMore } = mergeChunkPages([], 5);
    expect(page).toEqual([]);
    expect(cursors).toEqual([]);
    expect(hasMore).toBe(false);
  });

  it('tar bort dubbletter av samma post-id', () => {
    const { page } = mergeChunkPages([
      [post('a', 300)],
      [post('a', 300), post('b', 200)],
    ], 10);
    expect(page.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('behandlar saknad tidsstämpel som äldst', () => {
    const { page } = mergeChunkPages([
      [{ id: 'utan' }, post('med', 100)],
    ], 10);
    expect(page.map(p => p.id)).toEqual(['med', 'utan']);
  });
});

/**
 * Regressionstestet som betyder något: bläddra igenom hela flödet och
 * kontrollera att varje incheckning dyker upp exakt en gång.
 *
 * Den gamla implementationen delade en markör mellan alla chunkar och tappade
 * tyst de poster som sorterats bort ur en sida. Den här simuleringen fångar
 * det — den skulle inte gå igenom med en gemensam markör.
 */
describe('paginering över flera chunkar', () => {
  /**
   * Delar ut poster växelvis mellan chunkarna längs en global fallande
   * tidslinje. Interfolieringen är hela poängen: ligger chunkarna i separata
   * tidsintervall blir sammanslagningen trivial och testet mäter ingenting.
   */
  const byggKorpus = (antalPerChunk) => {
    const korpus = antalPerChunk.map(() => []);
    const kvar = [...antalPerChunk];
    let tid = 100000;
    let i = 0;
    while (kvar.some((n) => n > 0)) {
      const c = i % kvar.length;
      if (kvar[c] > 0) {
        korpus[c].push(post(`c${c}-p${korpus[c].length}`, tid));
        tid -= 7;
        kvar[c] -= 1;
      }
      i += 1;
    }
    return korpus;
  };

  /** Efterliknar Firestore: hämta pageSize poster efter markören. */
  const hamtaChunk = (allaIChunk, markor, pageSize) => {
    const start = markor
      ? allaIChunk.findIndex((p) => p.id === markor.id) + 1
      : 0;
    return allaIChunk.slice(start, start + pageSize);
  };

  const bladdraIgenom = (korpus, pageSize) => {
    let markorer = korpus.map(() => null);
    const insamlade = [];
    let varv = 0;

    for (;;) {
      const sidor = korpus.map((allaIChunk, i) =>
        hamtaChunk(allaIChunk, markorer[i], pageSize)
      );
      const { page, cursors, hasMore } = mergeChunkPages(sidor, pageSize);

      insamlade.push(...page);
      markorer = cursors.map((item, i) => item ?? markorer[i]);

      if (!hasMore || page.length === 0) break;
      if (++varv > 100) throw new Error('Loopar – markörerna går inte framåt');
    }

    return insamlade;
  };

  it('tappar ingen post när chunkarna är olika stora', () => {
    const korpus = byggKorpus([12, 7, 3]);
    const forvantat = korpus.flat().length;

    const insamlade = bladdraIgenom(korpus, 5);
    const ids = insamlade.map((p) => p.id);

    expect(new Set(ids).size).toBe(forvantat);
    expect(ids).toHaveLength(forvantat);
  });

  it('levererar posterna i fallande tidsordning', () => {
    const insamlade = bladdraIgenom(byggKorpus([8, 8]), 4);
    const tider = insamlade.map((p) => p.timestamp.toMillis());
    expect([...tider].sort((a, b) => b - a)).toEqual(tider);
  });

  it('tappar ingenting när en chunk är helt tom', () => {
    const korpus = byggKorpus([6, 0, 4]);
    const ids = bladdraIgenom(korpus, 3).map((p) => p.id);
    expect(new Set(ids).size).toBe(10);
  });

  it('klarar en enda chunk', () => {
    const ids = bladdraIgenom(byggKorpus([9]), 4).map((p) => p.id);
    expect(new Set(ids).size).toBe(9);
  });
});
