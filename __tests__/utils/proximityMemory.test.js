import {
  DISMISS_TTL_MS,
  RATED_TTL_MS,
  remember,
  activeExclusions,
  prune,
} from '../../utils/proximityMemory';

const T0 = 1_800_000_000_000;
const TIMME = 60 * 60 * 1000;

describe('remember', () => {
  it('lägger till en post', () => {
    const minne = remember({}, 'pg1', 'dismissed', T0);
    expect(minne.pg1).toEqual({ kind: 'dismissed', at: T0 });
  });

  it('muterar inte indata', () => {
    const original = {};
    remember(original, 'pg1', 'rated', T0);
    expect(original).toEqual({});
  });

  it('ett betyg skriver över ett tidigare avfärdande', () => {
    let minne = remember({}, 'pg1', 'dismissed', T0);
    minne = remember(minne, 'pg1', 'rated', T0 + 1000);
    expect(minne.pg1.kind).toBe('rated');
  });

  it('klarar odefinierat minne', () => {
    expect(remember(undefined, 'pg1', 'rated', T0).pg1.kind).toBe('rated');
  });

  it('ignorerar tomt id', () => {
    expect(remember({}, '', 'rated', T0)).toEqual({});
    expect(remember({}, null, 'rated', T0)).toEqual({});
  });
});

describe('activeExclusions', () => {
  it('utesluter nyss avfärdade lekplatser', () => {
    const minne = remember({}, 'pg1', 'dismissed', T0);
    expect(activeExclusions(minne, T0 + TIMME)).toEqual(['pg1']);
  });

  /**
   * Avfärdar man en lekplats vill man vara ifred ett tag — men inte för alltid.
   * Kommer man tillbaka senare samma dag ska frågan kunna ställas igen.
   */
  it('slutar utesluta avfärdade efter sex timmar', () => {
    const minne = remember({}, 'pg1', 'dismissed', T0);
    expect(activeExclusions(minne, T0 + DISMISS_TTL_MS - 1)).toEqual(['pg1']);
    expect(activeExclusions(minne, T0 + DISMISS_TTL_MS)).toEqual([]);
  });

  /** Har man redan betygsatt ska prompten inte komma tillbaka samma dag. */
  it('utesluter betygsatta i ett dygn', () => {
    const minne = remember({}, 'pg1', 'rated', T0);
    expect(activeExclusions(minne, T0 + 23 * TIMME)).toEqual(['pg1']);
    expect(activeExclusions(minne, T0 + RATED_TTL_MS)).toEqual([]);
  });

  it('hanterar flera lekplatser med olika status', () => {
    let minne = remember({}, 'pg1', 'rated', T0);
    minne = remember(minne, 'pg2', 'dismissed', T0);

    // Efter sju timmar: avfärdandet har gått ut, betyget inte
    expect(activeExclusions(minne, T0 + 7 * TIMME)).toEqual(['pg1']);
  });

  it('klarar tomt och trasigt minne', () => {
    expect(activeExclusions({}, T0)).toEqual([]);
    expect(activeExclusions(undefined, T0)).toEqual([]);
    expect(activeExclusions({ pg1: null }, T0)).toEqual([]);
    expect(activeExclusions({ pg1: { kind: 'rated' } }, T0)).toEqual([]);
  });

  it('okänd typ utesluter inte', () => {
    expect(activeExclusions({ pg1: { kind: 'nonsens', at: T0 } }, T0)).toEqual([]);
  });
});

describe('prune', () => {
  it('tar bort utgångna poster', () => {
    let minne = remember({}, 'pg1', 'dismissed', T0);
    minne = remember(minne, 'pg2', 'rated', T0);

    const kvar = prune(minne, T0 + 7 * TIMME);
    expect(Object.keys(kvar)).toEqual(['pg2']);
  });

  it('behåller allt som fortfarande gäller', () => {
    const minne = remember({}, 'pg1', 'rated', T0);
    expect(prune(minne, T0 + TIMME)).toEqual(minne);
  });

  it('muterar inte indata', () => {
    const minne = remember({}, 'pg1', 'dismissed', T0);
    prune(minne, T0 + 10 * TIMME);
    expect(minne.pg1).toBeTruthy();
  });

  it('klarar tomt minne', () => {
    expect(prune(undefined, T0)).toEqual({});
  });
});
