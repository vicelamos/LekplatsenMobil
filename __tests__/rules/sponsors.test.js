import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { createTestEnv, asUser, asGuest, seed, BASE_USERS } from './setup';

let testEnv;

beforeAll(async () => {
  testEnv = await createTestEnv();
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed(testEnv, {
    ...BASE_USERS,
    'sponsors/s1': { namn: 'Glassbaren', aktiv: true },
    'sponsors/s1/stats/2026-07-29': { date: '2026-07-29', badgeImpressions: 5 },
  });
});

describe('sponsors – sponsordokumentet', () => {
  it('gäst får läsa sponsorn (badgen visas för alla)', async () => {
    await assertSucceeds(getDoc(doc(asGuest(testEnv), 'sponsors/s1')));
  });

  it('vanlig användare får inte ändra en sponsor', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'sponsors/s1'), { namn: 'Kapat' })
    );
  });

  it('vanlig användare får inte skapa en sponsor', async () => {
    await assertFails(
      setDoc(doc(asUser(testEnv, 'alice'), 'sponsors/s2'), { namn: 'Egen reklam' })
    );
  });

  it('admin får skapa och ändra sponsorer', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'root'), 'sponsors/s2'), { namn: 'Ny sponsor' })
    );
  });
});

describe('sponsors – statistik, läsning', () => {
  it('admin får läsa statistiken', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'root'), 'sponsors/s1/stats/2026-07-29')));
  });

  it('vanlig användare får inte läsa statistiken', async () => {
    await assertFails(getDoc(doc(asUser(testEnv, 'alice'), 'sponsors/s1/stats/2026-07-29')));
  });

  it('gäst får inte läsa statistiken', async () => {
    await assertFails(getDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2026-07-29')));
  });
});

/**
 * Sponsorbadgen visas även för utloggade besökare, så loggningen måste vara
 * öppen för gäster. Det som ska vara låst är *formen*: exakt en känd räknare
 * får stiga med exakt ett steg per skrivning. Testerna nedan speglar precis
 * det anrop utils/sponsorAnalytics.js gör.
 */
describe('sponsors – logga analytik', () => {
  const EVENT_TYPES = ['badgeImpressions', 'popupOpens', 'hittaHitClicks', 'websiteClicks'];

  it('gäst får logga första händelsen för ett nytt datum', async () => {
    await assertSucceeds(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2099-01-01'), {
        date: '2099-01-01',
        badgeImpressions: 1,
      }, { merge: true })
    );
  });

  it('gäst får räkna upp en befintlig räknare ett steg', async () => {
    await assertSucceeds(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2026-07-29'), {
        date: '2026-07-29',
        badgeImpressions: 6,
      }, { merge: true })
    );
  });

  it('inloggad användare får också logga', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'alice'), 'sponsors/s1/stats/2026-07-29'), {
        date: '2026-07-29',
        badgeImpressions: 6,
      }, { merge: true })
    );
  });

  it.each(EVENT_TYPES)('alla händelsetyper går att logga: %s', async (eventType) => {
    await assertSucceeds(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2099-02-02'), {
        date: '2099-02-02',
        [eventType]: 1,
      }, { merge: true })
    );
  });

  it('gäst får inte sätta ett godtyckligt startvärde', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2099-01-01'), {
        date: '2099-01-01',
        badgeImpressions: 10_000_000,
      }, { merge: true })
    );
  });

  it('gäst får inte hoppa mer än ett steg', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2026-07-29'), {
        date: '2026-07-29',
        badgeImpressions: 500,
      }, { merge: true })
    );
  });

  it('gäst får inte räkna ned en räknare', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2026-07-29'), {
        date: '2026-07-29',
        badgeImpressions: 4,
      }, { merge: true })
    );
  });

  it('gäst får inte räkna upp två räknare i samma skrivning', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2026-07-29'), {
        date: '2026-07-29',
        badgeImpressions: 6,
        popupOpens: 1,
      }, { merge: true })
    );
  });

  it('gäst får inte smyga in ett okänt fält', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2026-07-29'), {
        date: '2026-07-29',
        badgeImpressions: 6,
        faktureras: true,
      }, { merge: true })
    );
  });

  it('gäst får inte ändra datumfältet i efterhand', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2026-07-29'), {
        date: '2020-01-01',
      }, { merge: true })
    );
  });

  it('gäst får inte skapa ett dokument vars datumfält inte matchar dokument-id', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2099-01-01'), {
        date: '2020-01-01',
        badgeImpressions: 1,
      }, { merge: true })
    );
  });

  it('gäst får inte skapa ett dokument utan datumfält', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2099-01-01'), {
        badgeImpressions: 1,
      }, { merge: true })
    );
  });

  it('gäst får inte radera statistik', async () => {
    await assertFails(deleteDoc(doc(asGuest(testEnv), 'sponsors/s1/stats/2026-07-29')));
  });

  it('inte ens admin får radera statistik från klienten', async () => {
    await assertFails(deleteDoc(doc(asUser(testEnv, 'root'), 'sponsors/s1/stats/2026-07-29')));
  });
});
