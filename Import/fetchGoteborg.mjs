/**
 * Hämtar Göteborgs lekplatser från goteborg.se och sparar som GeoJSON.
 * Data extraheras från JSON-LD (schema.org) på varje detailsida.
 *
 * Kör med: node fetchGoteborg.mjs
 * Test (5 st): node fetchGoteborg.mjs --limit 5
 */

import { writeFileSync } from 'fs';

const BASE_URL =
  'https://goteborg.se/wps/portal/start/uppleva-och-gora/parker-och-lekplatser/lekplatser/hitta-lekplatser';
const DELAY_MS = 250;
const OUTPUT_FILE = './import_goteborg.geojson';

const args = process.argv.slice(2);
const limitIndex = args.indexOf('--limit');
const LIMIT = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : Infinity;

// ---------------------------------------------------------------------------
// Hjälpfunktioner
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Hämta HTML-text från en URL med enkel retry vid fel.
 */
async function fetchHtml(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LekplatsenApp/1.0 (datainsamling)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`  ⚠️  Retry ${i + 1} för ${url}: ${err.message}`);
      await sleep(1000);
    }
  }
}

/**
 * Extrahera alla ?id=XXXX från en listningssida.
 */
function extractIds(html) {
  const ids = new Set();
  // Länkar med ?id= eller &id= eller hitta-lekplatser?id=
  const re = /hitta-lekplatser[^"']*[?&]id=(\d+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }
  return [...ids];
}

/**
 * Parsa JSON-LD från HTML, returnera det objekt med @type "Place" om det finns.
 */
const ACCEPTED_TYPES = new Set(['Place', 'LocalBusiness', 'TouristAttraction', 'Park']);

function parseJsonLd(html) {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (ACCEPTED_TYPES.has(obj['@type'])) return obj;
      if (Array.isArray(obj['@graph'])) {
        const found = obj['@graph'].find((o) => ACCEPTED_TYPES.has(o['@type']));
        if (found) return found;
      }
    } catch {
      // ignorera ogiltigt JSON
    }
  }
  return null;
}

/**
 * Extrahera ren beskrivningstext från JSON-LD description (HTML-sträng).
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hämta strukturerad Lekutbud-lista från additionalProperty.
 */
function extractLekutbud(additionalProperty) {
  if (!Array.isArray(additionalProperty)) return [];
  const prop = additionalProperty.find((p) => p.name === 'Lekutbud');
  if (!prop) return [];
  return Array.isArray(prop.value) ? prop.value : [prop.value];
}

// ---------------------------------------------------------------------------
// Steg 1: Samla alla playground-IDs från listningssidorna
// ---------------------------------------------------------------------------

async function collectAllIds() {
  const allIds = new Set();
  let page = 1;

  console.log('📋 Samlar lekplats-IDs från listningssidor...');

  while (true) {
    const url = `${BASE_URL}?page=${page}`;
    console.log(`  Sida ${page}: ${url}`);

    let html;
    try {
      html = await fetchHtml(url);
    } catch (err) {
      console.warn(`  ⚠️  Kunde inte hämta sida ${page}: ${err.message}. Avslutar.`);
      break;
    }

    const ids = extractIds(html);
    if (ids.length === 0) {
      console.log(`  Inga fler IDs på sida ${page}, avslutar.`);
      break;
    }

    ids.forEach((id) => allIds.add(id));
    console.log(`  → Hittade ${ids.length} IDs (totalt ${allIds.size})`);

    // Kolla om det finns en "nästa sida"-länk
    const hasNext = html.includes(`page=${page + 1}`);
    if (!hasNext) break;

    page++;
    await sleep(DELAY_MS);
  }

  return [...allIds];
}

// ---------------------------------------------------------------------------
// Steg 2: Hämta detailsida och extrahera data
// ---------------------------------------------------------------------------

async function fetchPlayground(id) {
  const url = `${BASE_URL}?id=${id}`;
  const html = await fetchHtml(url);

  const jsonLd = parseJsonLd(html);

  if (!jsonLd) {
    console.warn(`  ⚠️  Ingen JSON-LD hittad för id=${id}`);
    return null;
  }

  const lat = parseFloat(jsonLd.geo?.latitude);
  const lng = parseFloat(jsonLd.geo?.longitude);

  if (isNaN(lat) || isNaN(lng)) {
    console.warn(`  ⚠️  Inga koordinater för id=${id} (${jsonLd.name})`);
    return null;
  }

  const address =
    jsonLd.address?.streetAddress ||
    jsonLd.address?.addressLocality ||
    '';

  // Ren beskrivningstext (utan utrustning/hållplats-rader)
  const fullDescription = stripHtml(jsonLd.description || '');
  // Ta bara första stycket som beskrivning (innan "Redskap:")
  const beskrivning = fullDescription.split(/Redskap:/i)[0].trim();

  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    properties: {
      id,
      name: jsonLd.name || '',
      beskrivning,
      lekutbud: extractLekutbud(jsonLd.additionalProperty),
      bildUrl: jsonLd.image || '',
      address,
      sourceUrl: url,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const allIds = await collectAllIds();

  const idsToFetch = isFinite(LIMIT) ? allIds.slice(0, LIMIT) : allIds;
  console.log(`\n🔍 Hämtar ${idsToFetch.length} detailsidor...`);

  const features = [];
  let ok = 0;
  let skipped = 0;

  for (let i = 0; i < idsToFetch.length; i++) {
    const id = idsToFetch[i];
    process.stdout.write(`  [${i + 1}/${idsToFetch.length}] id=${id} `);

    try {
      const feature = await fetchPlayground(id);
      if (feature) {
        features.push(feature);
        console.log(`✅ ${feature.properties.name}`);
        ok++;
      } else {
        skipped++;
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      skipped++;
    }

    await sleep(DELAY_MS);
  }

  const geojson = { type: 'FeatureCollection', features };
  writeFileSync(OUTPUT_FILE, JSON.stringify(geojson, null, 2), 'utf-8');

  console.log(`\n🎉 Klar! ${ok} lekplatser sparade i ${OUTPUT_FILE} (${skipped} hoppades över)`);
}

main().catch((err) => {
  console.error('❌ Fel:', err);
  process.exit(1);
});
