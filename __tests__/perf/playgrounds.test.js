/**
 * Läsbudget för lekplatshämtningen.
 *
 * Fram tills nu låg den inline i HomeScreen och SearchScreen och gick därför
 * inte att mäta. Nu ligger den i servicelagret, och de här testerna låser fast
 * både vad den kostar idag och att cachen faktiskt gör sitt jobb.
 */

jest.mock('firebase/firestore', () => {
  const actual = jest.requireActual('firebase/firestore');
  global.__READS = { docs: 0, calls: 0 };
  return {
    ...actual,
    getDocs: async (...args) => {
      const snap = await actual.getDocs(...args);
      global.__READS.docs += snap.size;
      global.__READS.calls += 1;
      return snap;
    },
    getDoc: async (...args) => {
      const snap = await actual.getDoc(...args);
      global.__READS.docs += 1;
      global.__READS.calls += 1;
      return snap;
    },
  };
});

jest.mock('../../firebase', () => {
  const { initializeApp } = jest.requireActual('firebase/app');
  const fs = jest.requireActual('firebase/firestore');
  const app = initializeApp(
    { projectId: 'demo-lekplatsen-perf', apiKey: 'demo-key', appId: 'demo-app' },
    'perf-client-pg'
  );
  const db = fs.getFirestore(app);
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081').split(':');
  fs.connectFirestoreEmulator(db, host, Number(port));
  return { db, auth: {}, storage: {} };
});

import {
  getPlaygroundsWithSponsors,
  invalidatePlaygroundCache,
} from '../../src/services/playgroundService';

const { seedCorpus, clearAll, adminDb } = require('./seed');

const PLAYGROUNDS = 500;
const SPONSORS = 8;

async function measure(fn) {
  global.__READS.docs = 0;
  global.__READS.calls = 0;
  const result = await fn();
  return { result, docs: global.__READS.docs, calls: global.__READS.calls };
}

beforeAll(async () => {
  await clearAll();
  await seedCorpus({ playgrounds: PLAYGROUNDS, users: 5, friendsEach: 2, checkinsEach: 1 });

  // Några sponsorer, varav en kopplad till pg-0
  const db = adminDb();
  const batch = db.batch();
  for (let i = 0; i < SPONSORS; i++) {
    batch.set(db.collection('sponsors').doc(`s-${i}`), { name: `Sponsor ${i}`, aktiv: true });
  }
  batch.set(
    db.collection('lekplatser').doc('pg-0'),
    { sponsorship: { active: true, sponsorId: 's-0', level: 'guld' } },
    { merge: true }
  );
  await batch.commit();
}, 180000);

beforeEach(() => {
  invalidatePlaygroundCache();
});

describe('läsbudget – lekplatser med sponsorer', () => {
  /**
   * Baslinjen. Siffran ÄR databasens storlek: kostnaden skalar med antalet
   * lekplatser gånger antalet användare. Det är den här siffran geohash-arbetet
   * ska sänka, och testet ska då failas medvetet och skrivas om.
   */
  it('ett kallt anrop kostar en läsning per lekplats plus en per sponsor', async () => {
    const { result, docs, calls } = await measure(() => getPlaygroundsWithSponsors());

    expect(result).toHaveLength(PLAYGROUNDS);
    expect(calls).toBe(2); // lekplatser + sponsorer
    expect(docs).toBe(PLAYGROUNDS + SPONSORS);
  });

  it('kopplar på sponsordata utan extra läsningar', async () => {
    const { result } = await measure(() => getPlaygroundsWithSponsors());
    const sponsrad = result.find((p) => p.id === 'pg-0');

    expect(sponsrad.sponsorName).toBe('Sponsor 0');
    expect(result.filter((p) => p.sponsorData).length).toBe(1);
  });

  /**
   * Det som faktiskt sänker notan idag. Båda skärmarna hämtar via
   * useFocusEffect, alltså vid varje flikbyte — utan cache betalades hela
   * summan om varje gång.
   */
  it('ett andra anrop inom cachetiden kostar noll läsningar', async () => {
    await getPlaygroundsWithSponsors();
    const { result, docs, calls } = await measure(() => getPlaygroundsWithSponsors());

    expect(docs).toBe(0);
    expect(calls).toBe(0);
    expect(result).toHaveLength(PLAYGROUNDS);
  });

  it('fem flikbyten kostar lika mycket som ett', async () => {
    const forsta = await measure(() => getPlaygroundsWithSponsors());
    const resten = await measure(async () => {
      for (let i = 0; i < 4; i++) await getPlaygroundsWithSponsors();
    });

    expect(forsta.docs).toBe(PLAYGROUNDS + SPONSORS);
    expect(resten.docs).toBe(0);
  });

  it('force hoppar över cachen', async () => {
    await getPlaygroundsWithSponsors();
    const { docs } = await measure(() => getPlaygroundsWithSponsors({ force: true }));
    expect(docs).toBe(PLAYGROUNDS + SPONSORS);
  });

  it('invalidering gör att nästa anrop läser om', async () => {
    await getPlaygroundsWithSponsors();
    invalidatePlaygroundCache();
    const { docs } = await measure(() => getPlaygroundsWithSponsors());
    expect(docs).toBe(PLAYGROUNDS + SPONSORS);
  });

  it('cachen går ut efter fem minuter', async () => {
    const start = Date.now();
    await getPlaygroundsWithSponsors({ now: () => start });

    const straxInnan = await measure(() =>
      getPlaygroundsWithSponsors({ now: () => start + 5 * 60 * 1000 - 1 })
    );
    expect(straxInnan.docs).toBe(0);

    const efter = await measure(() =>
      getPlaygroundsWithSponsors({ now: () => start + 5 * 60 * 1000 })
    );
    expect(efter.docs).toBe(PLAYGROUNDS + SPONSORS);
  });
});
