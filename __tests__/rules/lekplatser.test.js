import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  createTestEnv, asUser, asGuest, seed, BASE_USERS, STORAGE_PREFIX,
} from './setup';

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
    'lekplatser/pg1': {
      namn: 'Slottsskogens lekplats',
      bildUrl: `${STORAGE_PREFIX}/o/gammal.jpg`,
    },
  });
});

describe('lekplatser – läsning', () => {
  it('gäst får läsa en lekplats', async () => {
    await assertSucceeds(getDoc(doc(asGuest(testEnv), 'lekplatser/pg1')));
  });

  it('inloggad får läsa en lekplats', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'alice'), 'lekplatser/pg1')));
  });
});

describe('lekplatser – skapa', () => {
  it('gäst får inte skapa lekplats', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'lekplatser/ny'), { namn: 'Ny' })
    );
  });

  it('vilken inloggad användare som helst får skapa lekplats', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'alice'), 'lekplatser/ny'), { namn: 'Ny' })
    );
  });
});

describe('lekplatser – uppdatera', () => {
  it('vanlig användare får inte ändra namnet', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'lekplatser/pg1'), { namn: 'Kapat' })
    );
  });

  /**
   * Regeln på firestore.rules L11-12 ser ut att tillåta att vem som helst byter
   * bildUrl till en bild i projektets egen storage — men den gör det inte.
   * `startsWith` finns inte i Firestore-regelspråket (bara `matches`, `split`,
   * `size` m.fl.), så hela grenen kastar "Function not found" och nekas alltid.
   * Testet beskriver verkligheten, inte avsikten. Se anteckning i rapporten.
   */
  it('vanlig användare får INTE byta bildUrl – regelgrenen är trasig', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'lekplatser/pg1'), {
        bildUrl: `${STORAGE_PREFIX}/o/ny.jpg`,
      })
    );
  });

  it('admin får sätta både bilder och bildUrl', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'root'), 'lekplatser/pg1'), {
        bilder: [`${STORAGE_PREFIX}/o/ny.jpg`],
        bildUrl: `${STORAGE_PREFIX}/o/ny.jpg`,
      })
    );
  });

  it('vanlig användare får inte peka bildUrl mot en extern domän', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'lekplatser/pg1'), {
        bildUrl: 'https://exempel.se/reklam.jpg',
      })
    );
  });

  it('vanlig användare får inte smyga med ett extra fält vid bildbyte', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'lekplatser/pg1'), {
        bildUrl: `${STORAGE_PREFIX}/o/ny.jpg`,
        namn: 'Kapat',
      })
    );
  });

  it('admin får ändra vilket fält som helst', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'root'), 'lekplatser/pg1'), { namn: 'Rättat namn' })
    );
  });
});

describe('lekplatser – radera', () => {
  it('vanlig användare får inte radera', async () => {
    await assertFails(deleteDoc(doc(asUser(testEnv, 'alice'), 'lekplatser/pg1')));
  });

  it('admin får radera', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(testEnv, 'root'), 'lekplatser/pg1')));
  });
});
