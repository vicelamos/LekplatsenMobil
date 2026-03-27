/**
 * Listar alla unika Lekutbud-värden från import_goteborg.geojson
 * och jämför med vad som finns i konfiguration/alternativ.
 *
 * Kör EFTER fetchGoteborg.mjs:
 *   node fetchGoteborg.mjs
 *   node analyzeUtrustning.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const raw = readFileSync('./import_goteborg.geojson', 'utf-8');
const features = JSON.parse(raw).features;

// Samla alla unika Lekutbud-värden från GeoJSON
const fromGbg = new Map(); // värde → antal förekomster
for (const f of features) {
  for (const item of (f.properties.lekutbud ?? [])) {
    fromGbg.set(item, (fromGbg.get(item) ?? 0) + 1);
  }
}

// Hämta befintliga utrustningsval från konfiguration/alternativ
const snap = await db.doc('konfiguration/alternativ').get();
const konfUtrustning = new Set(snap.exists ? (snap.data().utrustning ?? []) : []);

// Rapport
console.log(`\n📊 Unika utrustningsvärden från Göteborgs stad (${features.length} lekplatser):\n`);
const sorted = [...fromGbg.entries()].sort((a, b) => b[1] - a[1]);

const missing = [];
for (const [namn, count] of sorted) {
  const finns = konfUtrustning.has(namn);
  const status = finns ? '✅' : '❌ SAKNAS i konfiguration';
  console.log(`  ${status.padEnd(32)} ${String(count).padStart(3)}x  "${namn}"`);
  if (!finns) missing.push(namn);
}

console.log(`\n📋 Befintliga val i konfiguration/alternativ (utrustning):`);
for (const u of [...konfUtrustning].sort()) {
  console.log(`  • ${u}`);
}

if (missing.length) {
  console.log(`\n⚠️  ${missing.length} värden från Göteborg saknas i konfigurationen:`);
  console.log(missing.map(m => `  • "${m}"`).join('\n'));
} else {
  console.log('\n✅ Alla Göteborgsvärden finns redan i konfigurationen.');
}

process.exit(0);
