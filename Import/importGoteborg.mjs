/**
 * Importerar Göteborgs lekplatser från import_goteborg.geojson till Firestore.
 * Kör fetchGoteborg.mjs först för att generera GeoJSON-filen.
 *
 * Kör med: node importGoteborg.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, FieldPath } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ---------------------------------------------------------------------------
// Utrustnings-normalisering
// Göteborgs stad använder egna termer i Lekutbud – mappa till appens värden
// ---------------------------------------------------------------------------
// Göteborgs term → utrustning-värde i appen
const LEKUTBUD_MAP = {
  Sandlåda: 'Sandlåda',
  Rutschkana: 'Rutschkana',
  Bollplan: 'Bollplan',
  Kompisgunga: 'Gungor',
  Gunga: 'Gungor',
  Gungor: 'Gungor',
  'Övriga gungor': 'Gungor',
  Klätterlek: 'Klätterlek',
  Hinderbana: 'Hinderbana',
  Balanslek: 'Balanslek',
  Vattenlek: 'Vattenlek',
  Karusell: 'Karusell',
  Linbana: 'Linbana',
  Lekhus: 'Lekhus',
  Studsmatta: 'Studsmatta',
  Utegym: 'Utegym',
  Lekställning: 'Lekställning',
  Fjädergungor: 'Fjädergungor',
  Gungbräda: 'Gungbräda',
  Cykelslinga: 'Cykelslinga',
  Basketplan: 'Basketplan',
  Boulebana: 'Boulebana',
  Pumptrackbana: 'Pumptrackbana',
};

// Göteborgs termer som ska läggas i faciliteter istället för utrustning
const LEKUTBUD_FACILITETER = {
  Utflyktslekplats: 'Utflyktslekplats',
};

function normalizeUtrustning(lekutbud) {
  if (!Array.isArray(lekutbud)) return [];
  const result = new Set();
  for (const item of lekutbud) {
    if (item in LEKUTBUD_FACILITETER) continue; // hanteras separat
    const mapped = LEKUTBUD_MAP[item];
    if (mapped) result.add(mapped);
    else result.add(item);
  }
  return [...result];
}

function extractFaciliteter(beskrivning, lekutbud) {
  const fac = [];
  if (beskrivning) {
    if (/belysning|belyst/i.test(beskrivning)) fac.push('Belysning');
    if (/tillgänglighetsanpassad|rullstol|gummiasfalt|konstgräs/i.test(beskrivning))
      fac.push('Tillgänglighetsanpassad');
  }
  for (const item of (lekutbud ?? [])) {
    const mapped = LEKUTBUD_FACILITETER[item];
    if (mapped && !fac.includes(mapped)) fac.push(mapped);
  }
  return fac;
}

/**
 * Konvertera en GeoJSON Feature → Firestore-dokument
 */
/**
 * Fält som alltid uppdateras från källdata (goteborg.se).
 */
function sourceFields(feature) {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  return {
    namn: p.name || '',
    beskrivning: p.beskrivning || '',
    position: `${lat}, ${lng}`,
    location: { latitude: lat, longitude: lng },
    kommun: 'Göteborg',
    adress: p.address || '',
    bildUrl: p.bildUrl || '',
    utrustning: normalizeUtrustning(p.lekutbud),
    faciliteter: extractFaciliteter(p.beskrivning, p.lekutbud),
    visitUrl: p.sourceUrl || '',
  };
}

/**
 * Fält som bara sätts när dokumentet skapas första gången.
 */
const NEW_DOC_FIELDS = {
  status: 'publicerad',
  utmaningar: [],
  snittbetyg: 0,
  antalIncheckningar: 0,
  totalBetygSum: 0,
  createdAt: FieldValue.serverTimestamp(),
};

function slumpa3Utmaningar(pool) {
  if (pool.length < 3) return [...pool];
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const raw = readFileSync('./import_goteborg.geojson', 'utf-8');
  const geojson = JSON.parse(raw);
  const features = geojson.features;

  console.log(`📂 Läser ${features.length} lekplatser från import_goteborg.geojson`);

  // Hämta utmaningspool från Firestore (samma källa som admin-formuläret)
  console.log('🎯 Hämtar utmaningar från konfiguration/alternativ...');
  const konfSnap = await db.doc('konfiguration/alternativ').get();
  const utmaningarPool = konfSnap.exists ? (konfSnap.data().utmaningar ?? []) : [];
  console.log(`  → ${utmaningarPool.length} utmaningar tillgängliga\n`);

  // Kolla vilka IDs som redan finns i Firestore
  console.log('🔍 Kontrollerar befintliga dokument...');
  const existingSnap = await db.collection('lekplatser')
    .where(FieldPath.documentId(), '>=', 'GBG')
    .where(FieldPath.documentId(), '<', 'GBH')
    .select()
    .get();
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));
  console.log(`  → ${existingIds.size} GBG-dokument finns redan\n`);

  // Firestore batch max = 500; dela upp vid behov
  const BATCH_SIZE = 400;
  let count = 0;
  let updated = 0;

  for (let i = 0; i < features.length; i += BATCH_SIZE) {
    const chunk = features.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    let batchCount = 0;

    for (const feature of chunk) {
      const id = `GBG${feature.properties.id}`;
      const isNew = !existingIds.has(id);
      const fields = sourceFields(feature);
      const doc = isNew
        ? { ...fields, ...NEW_DOC_FIELDS, utmaningar: slumpa3Utmaningar(utmaningarPool) }
        : fields;
      const ref = db.collection('lekplatser').doc(id);

      // merge: true så att statistikfält inte skrivs över vid uppdatering
      batch.set(ref, doc, { merge: true });
      batchCount++;
      count++;

      const equip = fields.utrustning.length ? fields.utrustning.join(', ') : '–';
      const desc = fields.beskrivning ? fields.beskrivning.slice(0, 60) + '…' : '–';
      if (!isNew) updated++;
      const label = isNew ? '✅ NY' : '🔄 UPD';
      console.log(`  ${label} ${id} – ${fields.namn}  |  ${equip}  |  "${desc}"`);
    }

    if (batchCount > 0) {
      console.log(`\n⏳ Skriver batch (${batchCount} dokument)...`);
      await batch.commit();
    }
  }

  const newCount = count - updated;
  console.log(`\n🎉 Klart! ${newCount} nya + ${updated} uppdaterade lekplatser (${count} totalt).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Fel vid import:', err);
  process.exit(1);
});
