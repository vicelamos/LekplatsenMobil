import fs from 'fs';
import path from 'path';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

/**
 * `demo-`-prefixet gör att emulatorn aldrig kan råka prata med ett riktigt
 * Firebase-projekt — inga credentials krävs och inga skrivningar kan läcka
 * till vare sig lekplatsen-907fb eller viktor-2e4f9.
 */
export const PROJECT_ID = 'demo-lekplatsen';

/** Prefixet som firestore.rules kräver för bildUrl på lekplatser. */
export const STORAGE_PREFIX = `https://firebasestorage.googleapis.com/v0/b/${PROJECT_ID}`;

export async function createTestEnv() {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
}

/** Firestore-instans som en inloggad användare. */
export function asUser(testEnv, uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

/** Firestore-instans som utloggad gäst. */
export function asGuest(testEnv) {
  return testEnv.unauthenticatedContext().firestore();
}

/**
 * Skriver dokument förbi säkerhetsreglerna, för att sätta upp utgångsläget
 * i ett test. `writes` är en map av sökväg -> data.
 */
export async function seed(testEnv, writes) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    for (const [docPath, data] of Object.entries(writes)) {
      await setDoc(doc(adminDb, docPath), data);
    }
  });
}

/**
 * Standardaktörer som återanvänds i alla regeltester.
 * Alla tre har ett users-dokument eftersom flera regler gör
 * `get(/users/$(uid)).data.isAdmin` — saknas dokumentet blir regeln ett fel
 * och allt nekas, vilket döljer vad testet egentligen mäter.
 */
export const BASE_USERS = {
  'users/alice': { smeknamn: 'Alice', isAdmin: false, friends: ['bob'] },
  'users/bob': { smeknamn: 'Bob', isAdmin: false, friends: ['alice'] },
  'users/root': { smeknamn: 'Root', isAdmin: true, friends: [] },
};
