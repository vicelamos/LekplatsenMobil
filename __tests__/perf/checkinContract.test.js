/**
 * Kontraktstest: ett dokument byggt av buildCheckinDoc måste kunna hittas av
 * flödesfrågan.
 *
 * Den gamla checkinService skrev tidsstämpeln till fältet `skapad` medan
 * flödet sorterar och paginerar på `timestamp`. Incheckningar skapade den
 * vägen blev osynliga — utan att något felmeddelande någonsin syntes.
 * Det här testet gör den kopplingen explicit.
 */

jest.mock('firebase/firestore', () => jest.requireActual('firebase/firestore'));

jest.mock('../../firebase', () => {
  const { initializeApp } = jest.requireActual('firebase/app');
  const fs = jest.requireActual('firebase/firestore');
  const app = initializeApp(
    { projectId: 'demo-lekplatsen-perf', apiKey: 'demo-key', appId: 'demo-app' },
    'perf-client-contract'
  );
  const db = fs.getFirestore(app);
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8081').split(':');
  fs.connectFirestoreEmulator(db, host, Number(port));
  return { db, auth: {}, storage: {} };
});

import { buildCheckinDoc, CHECKIN_REQUIRED_FIELDS } from '../../utils/checkinDocument';
import { fetchFriendsFeedPage } from '../../src/services/feedService';

const { clearAll, adminDb } = require('./seed');

const admin = require('firebase-admin');

beforeAll(async () => {
  await clearAll();
});

describe('incheckningsdokumentets kontrakt mot flödet', () => {
  it('en snabbincheckning hittas av flödesfrågan', async () => {
    const dokument = buildCheckinDoc({
      playgroundId: 'pg-kontrakt',
      playgroundName: 'Kontraktslekplatsen',
      rating: 5,
      userId: 'user-kontrakt',
      userSmeknamn: 'Kontrakt',
    });

    await adminDb().collection('incheckningar').doc('ci-kontrakt').set({
      ...dokument,
      timestamp: admin.firestore.Timestamp.now(),
    });

    const { items } = await fetchFriendsFeedPage({
      userIds: ['user-kontrakt'],
      pageSize: 10,
    });

    expect(items.map((i) => i.id)).toContain('ci-kontrakt');
  });

  it('flödet får tillbaka alla fält det förlitar sig på', async () => {
    const { items } = await fetchFriendsFeedPage({
      userIds: ['user-kontrakt'],
      pageSize: 10,
    });

    const inlagg = items.find((i) => i.id === 'ci-kontrakt');
    for (const falt of CHECKIN_REQUIRED_FIELDS) {
      expect(inlagg).toHaveProperty(falt);
    }
    expect(inlagg.betyg).toBe(5);
  });

  it('ett dokument med fel tidsstämpelfält hittas INTE – som förväntat', async () => {
    const dokument = buildCheckinDoc({
      playgroundId: 'pg-kontrakt',
      rating: 3,
      userId: 'user-fel',
      userSmeknamn: 'Fel',
    });

    // Så här skrev den gamla servicen
    await adminDb().collection('incheckningar').doc('ci-fel').set({
      ...dokument,
      skapad: admin.firestore.Timestamp.now(),
    });

    const { items } = await fetchFriendsFeedPage({
      userIds: ['user-fel'],
      pageSize: 10,
    });

    expect(items.map((i) => i.id)).not.toContain('ci-fel');
  });
});
