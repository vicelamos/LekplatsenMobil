/**
 * Import Borås lekplatser from GeoJSON into Firestore
 * Kör med: node importBoras.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf-8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ---------------------------------------------------------------------------
// Utrustning – nyckelord i description → utrustning-värde
// ---------------------------------------------------------------------------
const EQUIPMENT_KEYWORDS = [
  { pattern: /gungor|gunga|kompisgunga/i, value: 'Gungor' },
  { pattern: /klätterpyramid/i, value: 'Klätterpyramid' },
  { pattern: /klätterlek|klättra/i, value: 'Klätterlek' },
  { pattern: /sandlåda|snadlåda/i, value: 'Sandlåda' },
  { pattern: /karusell|snurrkarusell|cykelkarusell|snurrlek|snurrkopp/i, value: 'Karusell' },
  { pattern: /lekhus|lekstuga/i, value: 'Lekhus' },
  { pattern: /linbana/i, value: 'Linbana' },
  { pattern: /hinderbana/i, value: 'Hinderbana' },
  { pattern: /studsmatta/i, value: 'Studsmatta' },
  { pattern: /rutsch|rörrutsch|tubrutsch/i, value: 'Rutschkana' },
  { pattern: /vattenlek/i, value: 'Vattenlek' },
  { pattern: /basketplan|basket/i, value: 'Basketplan' },
  { pattern: /boulebana/i, value: 'Boulebana' },
  { pattern: /pumptrack/i, value: 'Pumptrackbana' },
  { pattern: /utegym/i, value: 'Utegym' },
  { pattern: /lekställning/i, value: 'Lekställning' },
  { pattern: /lekkulle/i, value: 'Lekkulle' },
  { pattern: /fjädergunga/i, value: 'Fjädergungor' },
  { pattern: /gungbräda/i, value: 'Gungbräda' },
  { pattern: /balansplatta|balans/i, value: 'Balanslек' },
  { pattern: /bollspel|multisport/i, value: 'Bollplan' },
  { pattern: /cykelslinga/i, value: 'Cykelslinga' },
  { pattern: /volträcke/i, value: 'Volträcke' },
  { pattern: /brandbil/i, value: 'Brandbil' },
  { pattern: /polisbil/i, value: 'Polisbil' },
];

/**
 * Extrahera utrustning från en beskrivningstext
 */
function extractEquipment(description) {
  if (!description) return [];
  const found = new Set();
  for (const { pattern, value } of EQUIPMENT_KEYWORDS) {
    if (pattern.test(description)) {
      found.add(value);
    }
  }
  return [...found];
}

/**
 * Bygg faciliteter-array baserat på properties
 */
function extractFaciliteter(props) {
  const fac = [];
  if (props.lighting === true) fac.push('Belysning');
  if (props.accessibility === true) fac.push('Tillgänglighetsanpassad');
  return fac;
}

/**
 * Konvertera en GeoJSON Feature → Firestore-dokument
 */
function featureToDoc(feature) {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;

  return {
    namn: p.name || '',
    beskrivning: p.description || '',
    position: `${lat}, ${lng}`,
    location: { latitude: lat, longitude: lng },
    kommun: 'Borås',
    adress: '',
    bildUrl: '',
    status: 'publicerad',
    utrustning: extractEquipment(p.description),
    faciliteter: extractFaciliteter(p),
    utmaningar: [],
    snittbetyg: 0,
    antalIncheckningar: 0,
    totalBetygSum: 0,
    theme: p.theme || null,
    email: p.email || '',
    visitUrl: p.visit_url || '',
    lastRenovated: p.last_renovated || null,
    sourceUpdated: p.updated || null,
    createdAt: FieldValue.serverTimestamp(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const raw = readFileSync('./import_boras.geojson', 'utf-8');
  const geojson = JSON.parse(raw);
  const features = geojson.features;

  console.log(`📂 Läser ${features.length} lekplatser från import_boras.geojson`);

  // Firestore batch max = 500, vi har 161 så en batch räcker
  const batch = db.batch();
  let count = 0;

  for (const feature of features) {
    const id = `BS${feature.properties.id}`;
    const doc = featureToDoc(feature);
    const ref = db.collection('lekplatser').doc(id);
    batch.set(ref, doc);
    count++;

    const equip = doc.utrustning.length ? doc.utrustning.join(', ') : '–';
    const fac = doc.faciliteter.length ? doc.faciliteter.join(', ') : '–';
    console.log(`  ✅ ${id} – ${doc.namn}  |  Utrustning: ${equip}  |  Faciliteter: ${fac}`);
  }

  console.log(`\n⏳ Skriver ${count} dokument till Firestore...`);
  await batch.commit();
  console.log(`🎉 Klart! ${count} Borås-lekplatser importerade.`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Fel vid import:', err);
  process.exit(1);
});
