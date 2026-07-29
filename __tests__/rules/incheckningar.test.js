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
    'incheckningar/ci1': {
      userId: 'alice',
      lekplatsId: 'pg1',
      betyg: 4,
      kommentar: 'Toppen!',
      likes: [],
    },
    'incheckningar/ci2': {
      userId: 'alice',
      lekplatsId: 'pg1',
      betyg: 3,
      likes: ['bob'],
    },
    'incheckningar/ci3': {
      userId: 'alice',
      lekplatsId: 'pg1',
      likes: ['bob', 'carol'],
    },
    'incheckningar/ci4': {
      userId: 'alice',
      lekplatsId: 'pg1',
      likes: ['carol'],
    },
    // Äldre incheckning från innan likes-fältet infördes
    'incheckningar/ciGammal': {
      userId: 'alice',
      lekplatsId: 'pg1',
      betyg: 5,
    },
    'incheckningar/ci1/comments/c1': { userId: 'alice', text: 'Egen kommentar' },
  });
});

describe('incheckningar – läsning', () => {
  it('gäst får läsa incheckningar (flödet är publikt)', async () => {
    await assertSucceeds(getDoc(doc(asGuest(testEnv), 'incheckningar/ci1')));
  });
});

describe('incheckningar – skapa', () => {
  it('gäst får inte skapa incheckning', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'incheckningar/ny'), { userId: 'alice', lekplatsId: 'pg1' })
    );
  });

  it('användaren får skapa incheckning i eget namn', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'alice'), 'incheckningar/ny'), {
        userId: 'alice',
        lekplatsId: 'pg1',
      })
    );
  });

  it('användaren får inte skapa incheckning i någon annans namn', async () => {
    await assertFails(
      setDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ny'), {
        userId: 'alice',
        lekplatsId: 'pg1',
      })
    );
  });
});

describe('incheckningar – likes', () => {
  it('bob får lägga till sin egen like', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1'), { likes: ['bob'] })
    );
  });

  it('bob får ta bort sin egen like', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci2'), { likes: [] })
    );
  });

  it('bob får likea en incheckning som redan har andras likes', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci4'), { likes: ['carol', 'bob'] })
    );
  });

  it('ordningen i listan spelar ingen roll', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci4'), { likes: ['bob', 'carol'] })
    );
  });

  it('bob får likea en gammal incheckning som saknar likes-fält', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ciGammal'), { likes: ['bob'] })
    );
  });

  it('ägaren får likea sin egen incheckning', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'alice'), 'incheckningar/ci1'), { likes: ['alice'] })
    );
  });

  it('gäst får inte likea', async () => {
    await assertFails(
      updateDoc(doc(asGuest(testEnv), 'incheckningar/ci1'), { likes: ['bob'] })
    );
  });

  it('bob får inte likea i alices namn', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1'), { likes: ['alice'] })
    );
  });

  it('bob får inte lägga till två likes samtidigt', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1'), { likes: ['bob', 'carol'] })
    );
  });

  it('bob får inte lägga till sig själv två gånger', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1'), { likes: ['bob', 'bob'] })
    );
  });

  it('bob får inte ta bort någon annans like', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci4'), { likes: [] })
    );
  });

  it('bob får inte nolla hela likes-listan i ett svep', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci3'), { likes: [] })
    );
  });

  it('bob får inte smyga med ett betyg när han likear', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1'), {
        likes: ['bob'],
        betyg: 1,
      })
    );
  });
});

describe('incheckningar – redigera', () => {
  it('ägaren får ändra betyg och kommentar', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'alice'), 'incheckningar/ci1'), {
        betyg: 5,
        kommentar: 'Ännu bättre',
        redigerad: true,
      })
    );
  });

  it('ägaren får inte flytta incheckningen till en annan lekplats', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'incheckningar/ci1'), { lekplatsId: 'pg2' })
    );
  });

  it('ägaren får inte byta ägare', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'incheckningar/ci1'), { userId: 'bob' })
    );
  });

  it('en annan användare får inte ändra kommentaren', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1'), { kommentar: 'Kapat' })
    );
  });

  it('admin får inte heller ändra någon annans incheckning', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'root'), 'incheckningar/ci1'), { kommentar: 'Modererat' })
    );
  });
});

describe('incheckningar – radera', () => {
  it('ägaren får radera sin egen incheckning', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(testEnv, 'alice'), 'incheckningar/ci1')));
  });

  it('admin får radera vilken incheckning som helst', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(testEnv, 'root'), 'incheckningar/ci1')));
  });

  it('en annan användare får inte radera', async () => {
    await assertFails(deleteDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1')));
  });

  it('gäst får inte radera', async () => {
    await assertFails(deleteDoc(doc(asGuest(testEnv), 'incheckningar/ci1')));
  });

  /**
   * Gästincheckningar görs med anonym Firebase-auth och saknar users-dokument.
   * Ägargrenen måste därför utvärderas före admin-uppslaget, annars blir
   * get() på ett saknat dokument ett fel som nekar raderingen.
   */
  it('en anonym gäst får radera sin egen incheckning', async () => {
    await seed(testEnv, {
      'incheckningar/ciGast': { userId: 'anon-123', lekplatsId: 'pg1', isGuest: true, likes: [] },
    });
    await assertSucceeds(
      deleteDoc(doc(asUser(testEnv, 'anon-123'), 'incheckningar/ciGast'))
    );
  });

  it('en användare utan users-dokument får inte radera någon annans', async () => {
    await assertFails(
      deleteDoc(doc(asUser(testEnv, 'anon-456'), 'incheckningar/ci1'))
    );
  });
});

describe('incheckningar – kommentarer', () => {
  it('gäst får läsa kommentarer', async () => {
    await assertSucceeds(getDoc(doc(asGuest(testEnv), 'incheckningar/ci1/comments/c1')));
  });

  it('inloggad får kommentera', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1/comments/ny'), {
        userId: 'bob',
        text: 'Snyggt!',
      })
    );
  });

  it('gäst får inte kommentera', async () => {
    await assertFails(
      setDoc(doc(asGuest(testEnv), 'incheckningar/ci1/comments/ny'), {
        userId: 'bob',
        text: 'Spam',
      })
    );
  });

  /**
   * Create-regeln kräver bara `request.auth != null` — den kontrollerar inte
   * att userId matchar avsändaren. Bob kan alltså skriva en kommentar som ser
   * ut att komma från Alice. Se anteckning i rapporten.
   */
  it('bob KAN skriva en kommentar i alices namn (saknad ägarkontroll)', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1/comments/forfalskad'), {
        userId: 'alice',
        text: 'Detta skrev inte Alice',
      })
    );
  });

  it('bob får inte radera alices kommentar', async () => {
    await assertFails(deleteDoc(doc(asUser(testEnv, 'bob'), 'incheckningar/ci1/comments/c1')));
  });

  it('alice får radera sin egen kommentar', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(testEnv, 'alice'), 'incheckningar/ci1/comments/c1')));
  });
});
