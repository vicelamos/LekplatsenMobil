/**
 * Läsbudget för flödet.
 *
 * Poängen är inte att mäta millisekunder utan DOKUMENTLÄSNINGAR — det är det
 * Firestore fakturerar, och det är den siffra som tyst exploderar när
 * databasen växer. Testerna failar om någon återinför en fråga vars kostnad
 * skalar med databasens storlek i stället för med det som visas på skärmen.
 */

// Räknar varje läsning som går genom klient-SDK:t. Måste ligga i mock-fabriken
// eftersom jest hissar upp jest.mock ovanför all annan kod i filen.
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

// Appens firebase.js läser konfiguration via expo-constants och går inte att
// använda i node. Här kopplas den mot emulatorn i stället.
jest.mock('../../firebase', () => {
  const { initializeApp } = jest.requireActual('firebase/app');
  const fs = jest.requireActual('firebase/firestore');
  const app = initializeApp(
    { projectId: 'demo-lekplatsen-perf', apiKey: 'demo-key', appId: 'demo-app' },
    'perf-client'
  );
  const db = fs.getFirestore(app);
  // emulators:exec sätter FIRESTORE_EMULATOR_HOST; fallbacken matchar porten
  // i firebase.perf.json.
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081').split(':');
  fs.connectFirestoreEmulator(db, host, Number(port));
  return { db, auth: {}, storage: {} };
});

import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { fetchFriendsFeedPage, enrichPlaygroundsWithImages } from '../../src/services/feedService';

const { seedCorpus, seedCheckinsFor, clearAll } = require('./seed');

const PLAYGROUNDS = 500;
const USERS = 40;
const CHECKINS_EACH = 10;
const PAGE_SIZE = 10;

let korpus;

/** Nollställer räknaren, kör operationen och returnerar vad den kostade. */
async function measure(fn) {
  global.__READS.docs = 0;
  global.__READS.calls = 0;
  const result = await fn();
  return { result, docs: global.__READS.docs, calls: global.__READS.calls };
}

beforeAll(async () => {
  await clearAll();
  korpus = await seedCorpus({
    playgrounds: PLAYGROUNDS,
    users: USERS,
    friendsEach: 20,
    checkinsEach: CHECKINS_EACH,
  });
}, 180000);

describe('läsbudget – en sida av vänflödet', () => {
  it('kostar högst en läsning per hämtad post', async () => {
    const userIds = korpus.userIds.slice(0, 21); // ryms i en in-fråga
    const { result, docs, calls } = await measure(() =>
      fetchFriendsFeedPage({ userIds, pageSize: PAGE_SIZE })
    );

    expect(result.items).toHaveLength(PAGE_SIZE);
    expect(calls).toBe(1);
    expect(docs).toBeLessThanOrEqual(PAGE_SIZE);
  });

  /**
   * Det här är testet som betyder något. Databasen innehåller 500 lekplatser
   * och 400 incheckningar — kostnaden för en flödessida får inte veta om det.
   */
  it('kostar lika mycket oavsett hur stor databasen är', async () => {
    const userIds = korpus.userIds.slice(0, 21);
    const { docs } = await measure(() =>
      fetchFriendsFeedPage({ userIds, pageSize: PAGE_SIZE })
    );

    expect(docs).toBeLessThanOrEqual(PAGE_SIZE);
    expect(docs).toBeLessThan(PLAYGROUNDS);
    expect(docs).toBeLessThan(korpus.totalCheckins);
  });

  it('använder en fråga per påbörjad grupp om 30 vänner', async () => {
    const { calls: enGrupp } = await measure(() =>
      fetchFriendsFeedPage({ userIds: korpus.userIds.slice(0, 30), pageSize: PAGE_SIZE })
    );
    const { calls: tvaGrupper } = await measure(() =>
      fetchFriendsFeedPage({ userIds: korpus.userIds.slice(0, 40), pageSize: PAGE_SIZE })
    );

    expect(enGrupp).toBe(1);
    expect(tvaGrupper).toBe(2);
  });

  it('kostar lika mycket för sida två som för sida ett', async () => {
    const userIds = korpus.userIds.slice(0, 21);

    const forsta = await measure(() =>
      fetchFriendsFeedPage({ userIds, pageSize: PAGE_SIZE })
    );
    const andra = await measure(() =>
      fetchFriendsFeedPage({ userIds, pageSize: PAGE_SIZE, cursors: forsta.result.cursors })
    );

    expect(andra.docs).toBeLessThanOrEqual(forsta.docs);
    expect(andra.result.items).toHaveLength(PAGE_SIZE);

    // Sidorna får inte överlappa – det var precis det den gamla pagineringen gjorde
    const forstaIds = forsta.result.items.map((i) => i.id);
    const andraIds = andra.result.items.map((i) => i.id);
    expect(forstaIds.filter((id) => andraIds.includes(id))).toEqual([]);
  });
});

describe('läsbudget – nuvarande mönster som inte skalar', () => {
  /**
   * Dokumenterar dagens beteende på HomeScreen och SearchScreen: hela
   * lekplatssamlingen läses vid varje sidladdning. Siffran ÄR antalet
   * lekplatser, alltså skalar kostnaden med databasen gånger antalet
   * användare. Testet är en baslinje att mäta geohash-arbetet mot.
   */
  it('att läsa hela lekplatssamlingen kostar en läsning per lekplats', async () => {
    const { docs } = await measure(() =>
      getDocs(query(collection(db, 'lekplatser')))
    );
    expect(docs).toBe(PLAYGROUNDS);
  });

  /**
   * "Lekplatser nära dig" visar fem kort, och bildberikningen gör en egen
   * fråga per kort — ett klassiskt N+1.
   */
  it('bildberikning gör en fråga per lekplats', async () => {
    const fem = korpus.lekplatsIds.slice(0, 5).map((id) => ({ id, bildUrl: '' }));
    const { calls } = await measure(() => enrichPlaygroundsWithImages(fem));
    expect(calls).toBe(5);
  });

  /**
   * Och varje sådan fråga läser upp till tio incheckningar. På en populär
   * lekplats kostar det alltså tio dokumentläsningar att välja EN miniatyrbild.
   */
  it('en populär lekplats kostar tio läsningar för en miniatyrbild', async () => {
    await seedCheckinsFor('pg-0', 12);

    const { docs, calls } = await measure(() =>
      enrichPlaygroundsWithImages([{ id: 'pg-0', bildUrl: '' }])
    );

    expect(calls).toBe(1);
    expect(docs).toBe(10); // limit(10) i getPlaygroundImage
  });
});
