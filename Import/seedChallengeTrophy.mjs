/**
 * Seed-script: Lägg till trofén "Utmaningar" i Firestore
 * Kör med: node seedChallengeTrophy.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const trophy = {
  title: 'Utmaningar',
  description: 'Klara utmaningar på lekplatser',
  iconName: 'trophy',
  statToTrack: 'totalCompletedChallenges',
  levels: [
    { value: 1,  title: 'Nybörjare' },
    { value: 5,  title: 'Lärling' },
    { value: 10, title: 'Utmanare' },
    { value: 25, title: 'Erfaren' },
    { value: 50, title: 'Profs' },
    { value: 100, title: 'Mästare' },
    { value: 200, title: 'Elit' },
    { value: 500, title: 'Stjärna' },
    { value: 1000, title: 'Legendar' },
    { value: 2000, title: 'Ikon' },
    { value: 5000, title: 'Mythos' },
    { value: 10000, title: 'Odödlig' },
  ],
};

async function seed() {
  await db.collection('trophies').doc('utmaningar').set(trophy);
  console.log('Trofé "Utmaningar" skapad!');
  process.exit(0);
}

seed().catch(console.error);
