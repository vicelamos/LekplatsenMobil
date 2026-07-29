/**
 * Fyller emulatorn med realistisk volym.
 *
 * Skriver via admin-SDK:t (som går förbi säkerhetsreglerna) medan mätningen
 * sker via klient-SDK:t — samma uppdelning som i verkligheten, där servern
 * fyller databasen och appen läser ur den.
 */
const admin = require('firebase-admin');

const PROJECT_ID = 'demo-lekplatsen-perf';

let app;
function adminDb() {
  if (!app) {
    // Sätts av emulators:exec; fallbacken gäller bara vid fristående körning.
    process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8081';
    app = admin.initializeApp({ projectId: PROJECT_ID }, `seed-${Date.now()}`);
  }
  return app.firestore();
}

/** Skriver dokument i portioner – en batch rymmer 500 skrivningar. */
async function batchWrite(db, docs) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const { ref, data } of docs.slice(i, i + 400)) batch.set(ref, data);
    await batch.commit();
  }
}

/**
 * @param {object} opts
 * @param {number} opts.playgrounds  antal lekplatser
 * @param {number} opts.users        antal användare
 * @param {number} opts.friendsEach  vänner per användare
 * @param {number} opts.checkinsEach incheckningar per användare
 */
async function seedCorpus({
  playgrounds = 500,
  users = 50,
  friendsEach = 20,
  checkinsEach = 10,
} = {}) {
  const db = adminDb();

  const lekplatsIds = Array.from({ length: playgrounds }, (_, i) => `pg-${i}`);
  await batchWrite(db, lekplatsIds.map((id, i) => ({
    ref: db.collection('lekplatser').doc(id),
    data: {
      namn: `Lekplats ${i}`,
      kommun: i % 2 === 0 ? 'Göteborg' : 'Borås',
      status: 'publicerad',
      position: `${57.7 + (i % 100) / 1000}, ${11.9 + (i % 100) / 1000}`,
      antalIncheckningar: 0,
      snittbetyg: 0,
      bildUrl: '',
    },
  })));

  const userIds = Array.from({ length: users }, (_, i) => `user-${i}`);
  await batchWrite(db, userIds.map((id, i) => ({
    ref: db.collection('users').doc(id),
    data: {
      smeknamn: `Anv ${i}`,
      // Vännerna är de närmast följande användarna, cirkulärt
      friends: Array.from({ length: friendsEach }, (_, n) => `user-${(i + n + 1) % users}`),
      totalCheckinCount: checkinsEach,
      visitedPlaygroundIds: [],
    },
  })));

  // Incheckningarna varvas mellan användarna längs en fallande tidslinje, så
  // att vännernas poster faktiskt interfolieras i flödet.
  const checkins = [];
  let millis = Date.now();
  for (let n = 0; n < checkinsEach; n++) {
    for (let u = 0; u < users; u++) {
      const id = `ci-${u}-${n}`;
      checkins.push({
        ref: db.collection('incheckningar').doc(id),
        data: {
          userId: `user-${u}`,
          userSmeknamn: `Anv ${u}`,
          lekplatsId: lekplatsIds[(u * 7 + n) % playgrounds],
          betyg: (n % 5) + 1,
          kommentar: 'Trevligt!',
          bildUrl: '',
          likes: [],
          taggadeVanner: [],
          timestamp: admin.firestore.Timestamp.fromMillis(millis),
        },
      });
      millis -= 1000;
    }
  }
  await batchWrite(db, checkins);

  return { lekplatsIds, userIds, totalCheckins: checkins.length };
}

/** Lägger extra incheckningar på en enskild lekplats – en "populär" lekplats. */
async function seedCheckinsFor(lekplatsId, count) {
  const db = adminDb();
  let millis = Date.now();
  const docs = Array.from({ length: count }, (_, n) => {
    millis -= 1000;
    return {
      ref: db.collection('incheckningar').doc(`pop-${lekplatsId}-${n}`),
      data: {
        userId: `user-${n % 5}`,
        lekplatsId,
        betyg: 4,
        bildUrl: '',
        likes: [],
        taggadeVanner: [],
        timestamp: admin.firestore.Timestamp.fromMillis(millis),
      },
    };
  });
  await batchWrite(db, docs);
}

async function clearAll() {
  const db = adminDb();
  for (const c of ['lekplatser', 'users', 'incheckningar']) {
    await db.recursiveDelete(db.collection(c));
  }
}

module.exports = { PROJECT_ID, seedCorpus, seedCheckinsFor, clearAll, adminDb };
