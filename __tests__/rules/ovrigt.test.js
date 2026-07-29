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
    'trophies/t1': { namn: 'Första incheckningen' },
    'konfiguration/app': { minVersion: '1.0.0' },
    'friendRequests/fr1': { fromUserId: 'alice', toUserId: 'bob', status: 'pending' },
    'nyheter/publicerad1': { rubrik: 'Nyhet', publicerad: true },
    'nyheter/utkast1': { rubrik: 'Hemligt utkast', publicerad: false },
    'rapporter/r1': { reportedByUserId: 'alice', orsak: 'Olämpligt' },
    'andringsforslag/f1': { userId: 'alice', text: 'Fel adress' },
    '_rateLimits/alice': { count: 1 },
  });
});

describe('trophies och konfiguration – läs-bara referensdata', () => {
  it('gäst får läsa trofédefinitioner', async () => {
    await assertSucceeds(getDoc(doc(asGuest(testEnv), 'trophies/t1')));
  });

  it('inte ens admin får ändra trofédefinitioner från klienten', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'root'), 'trophies/t1'), { namn: 'Ändrad' })
    );
  });

  it('gäst får läsa konfigurationen', async () => {
    await assertSucceeds(getDoc(doc(asGuest(testEnv), 'konfiguration/app')));
  });

  it('inte ens admin får skriva konfigurationen från klienten', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'root'), 'konfiguration/app'), { minVersion: '2.0.0' })
    );
  });
});

describe('friendRequests', () => {
  it('avsändaren får läsa sin förfrågan', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'alice'), 'friendRequests/fr1')));
  });

  it('mottagaren får läsa förfrågan', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'bob'), 'friendRequests/fr1')));
  });

  it('utomstående får inte läsa förfrågan', async () => {
    await assertFails(getDoc(doc(asUser(testEnv, 'root'), 'friendRequests/fr1')));
  });

  it('användaren får skicka förfrågan i eget namn', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'alice'), 'friendRequests/ny'), {
        fromUserId: 'alice',
        toUserId: 'root',
        status: 'pending',
      })
    );
  });

  it('användaren får inte skicka förfrågan i någon annans namn', async () => {
    await assertFails(
      setDoc(doc(asUser(testEnv, 'bob'), 'friendRequests/ny'), {
        fromUserId: 'alice',
        toUserId: 'root',
        status: 'pending',
      })
    );
  });

  it('mottagaren får acceptera förfrågan', async () => {
    await assertSucceeds(
      updateDoc(doc(asUser(testEnv, 'bob'), 'friendRequests/fr1'), { status: 'accepted' })
    );
  });

  it('avsändaren får inte acceptera sin egen förfrågan', async () => {
    await assertFails(
      updateDoc(doc(asUser(testEnv, 'alice'), 'friendRequests/fr1'), { status: 'accepted' })
    );
  });

  it('avsändaren får dra tillbaka sin förfrågan', async () => {
    await assertSucceeds(deleteDoc(doc(asUser(testEnv, 'alice'), 'friendRequests/fr1')));
  });
});

describe('nyheter', () => {
  it('gäst får läsa publicerade nyheter', async () => {
    await assertSucceeds(getDoc(doc(asGuest(testEnv), 'nyheter/publicerad1')));
  });

  it('gäst får inte läsa opublicerade utkast', async () => {
    await assertFails(getDoc(doc(asGuest(testEnv), 'nyheter/utkast1')));
  });

  it('vanlig inloggad får inte läsa opublicerade utkast', async () => {
    await assertFails(getDoc(doc(asUser(testEnv, 'alice'), 'nyheter/utkast1')));
  });

  it('admin får läsa opublicerade utkast', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'root'), 'nyheter/utkast1')));
  });

  it('vanlig användare får inte publicera nyheter', async () => {
    await assertFails(
      setDoc(doc(asUser(testEnv, 'alice'), 'nyheter/ny'), { rubrik: 'Spam', publicerad: true })
    );
  });

  it('admin får publicera nyheter', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'root'), 'nyheter/ny'), { rubrik: 'Nyhet', publicerad: true })
    );
  });
});

describe('rapporter', () => {
  it('användaren får rapportera i eget namn', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'alice'), 'rapporter/ny'), {
        reportedByUserId: 'alice',
        orsak: 'Olämpligt innehåll',
      })
    );
  });

  it('användaren får inte rapportera i någon annans namn', async () => {
    await assertFails(
      setDoc(doc(asUser(testEnv, 'bob'), 'rapporter/ny'), {
        reportedByUserId: 'alice',
        orsak: 'Falsk anmälan',
      })
    );
  });

  it('anmälaren får inte läsa tillbaka sin egen rapport', async () => {
    await assertFails(getDoc(doc(asUser(testEnv, 'alice'), 'rapporter/r1')));
  });

  it('admin får läsa rapporter', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'root'), 'rapporter/r1')));
  });

  it('inte ens admin får radera en rapport', async () => {
    await assertFails(deleteDoc(doc(asUser(testEnv, 'root'), 'rapporter/r1')));
  });
});

describe('andringsforslag', () => {
  it('användaren får skicka in förslag i eget namn', async () => {
    await assertSucceeds(
      setDoc(doc(asUser(testEnv, 'alice'), 'andringsforslag/ny'), {
        userId: 'alice',
        text: 'Saknad gunga',
      })
    );
  });

  it('användaren får inte läsa förslagslistan', async () => {
    await assertFails(getDoc(doc(asUser(testEnv, 'alice'), 'andringsforslag/f1')));
  });

  it('admin får läsa och hantera förslag', async () => {
    await assertSucceeds(getDoc(doc(asUser(testEnv, 'root'), 'andringsforslag/f1')));
  });
});

describe('interna samlingar – helt stängda för klienten', () => {
  it('admin får inte läsa _rateLimits', async () => {
    await assertFails(getDoc(doc(asUser(testEnv, 'root'), '_rateLimits/alice')));
  });

  it('admin får inte skriva _processedEvents', async () => {
    await assertFails(
      setDoc(doc(asUser(testEnv, 'root'), '_processedEvents/e1'), { done: true })
    );
  });
});
