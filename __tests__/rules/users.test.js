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
    'users/alice/notifications/n1': { read: false, text: 'Hej' },
    'users/alice/unlockedTrophies/t1': { unlockedAt: 1 },
  });
});

describe('users – läsning', () => {
  /**
   * Gäster kan inte läsa profiler. Det är därför feedService.js måste
   * fånga permission-denied och falla tillbaka på incheckningens egna fält
   * när en utloggad besökare tittar på flödet.
   */
  it('gäst får inte läsa profiler', async () => {
    await assertFails(getDoc(doc(asGuest(testEnv), 'users/alice')));
  });

  it('inloggad får läsa en annan användares profil', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'bob'), 'users/alice')));
  });
});

describe('users – skapa', () => {
  it('användaren får skapa sitt eget dokument', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'carol'), 'users/carol'), { smeknamn: 'Carol' })
    );
  });

  it('användaren får inte skapa någon annans dokument', async () => {
    await assertFails(
      setDoc(doc(asUser(testEnv, 'carol'), 'users/dave'), { smeknamn: 'Dave' })
    );
  });
});

describe('users – uppdatera', () => {
  it('användaren får ändra sitt smeknamn', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'alice'), 'users/alice'), {
        smeknamn: 'Alice A',
        smeknamnLower: 'alice a',
      })
    );
  });

  it('användaren får INTE göra sig själv till admin', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'users/alice'), { isAdmin: true })
    );
  });

  it('användaren får inte smyga med isAdmin bland tillåtna fält', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'users/alice'), {
        smeknamn: 'Alice A',
        isAdmin: true,
      })
    );
  });

  /**
   * Trophies delas ut av Cloud Functions. Klienten får inte skriva räknarna
   * som trofélogiken lyssnar på... förutom att den faktiskt får det:
   * totalCheckinCount står med i listan över tillåtna fält.
   * Se anteckning i rapporten.
   */
  it('användaren KAN skriva sin egen incheckningsräknare', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'alice'), 'users/alice'), { totalCheckinCount: 9999 })
    );
  });

  it('användaren får inte ändra någon annans smeknamn', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'bob'), 'users/alice'), { smeknamn: 'Kapat' })
    );
  });

  it('bob får ta bort sig själv ur alices vänlista', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'bob'), 'users/alice'), { friends: [] })
    );
  });

  it('bob får inte lägga till sig själv i någons vänlista', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'bob'), 'users/root'), { friends: ['bob'] })
    );
  });
});

describe('users – radera', () => {
  it('användaren får radera sitt eget konto', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(testEnv, 'alice'), 'users/alice')));
  });

  it('användaren får inte radera någon annans konto', async () => {
    await assertFails(deleteDoc(doc(asUser(testEnv, 'bob'), 'users/alice')));
  });
});

describe('users – notiser', () => {
  it('användaren får läsa sina egna notiser', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'alice'), 'users/alice/notifications/n1')));
  });

  it('användaren får inte läsa någon annans notiser', async () => {
    await assertFails(getDoc(doc(asUser(testEnv, 'bob'), 'users/alice/notifications/n1')));
  });

  it('användaren får markera sin notis som läst', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'alice'), 'users/alice/notifications/n1'), { read: true })
    );
  });

  it('vanlig användare får inte skapa notiser hos någon annan', async () => {
    await assertFails(
      setDoc(doc(asUser(testEnv, 'bob'), 'users/alice/notifications/ny'), { read: false })
    );
  });

  it('admin får skapa notiser hos vem som helst', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'root'), 'users/alice/notifications/ny'), { read: false })
    );
  });
});

describe('users – troféer', () => {
  it('användaren får läsa sina upplåsta troféer', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'alice'), 'users/alice/unlockedTrophies/t1')));
  });

  it('användaren får inte låsa upp en trofé själv', async () => {
    await assertFails(
      setDoc(doc(asUser(testEnv, 'alice'), 'users/alice/unlockedTrophies/fusk'), { unlockedAt: 1 })
    );
  });
});
