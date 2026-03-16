const admin = require('firebase-admin');
const serviceAccount = require("./serviceAccountKey.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function deleteBSDocs() {
  console.log("🔍 Söker efter dokument som börjar med BS...");
  
  const snapshot = await db.collection('lekplatser').get();
  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    if (doc.id.startsWith('BS')) {
      batch.delete(doc.ref);
      count++;
      console.log(`🗑️ Köar radering av: ${doc.id}`);
    }
  });

  if (count === 0) {
    console.log("✨ Inga dokument som börjar med BS hittades.");
    return;
  }

  await batch.commit();
  console.log(`\n✅ Klart! Raderade ${count} st BS-dokument.`);
  process.exit();
}

deleteBSDocs().catch(err => {
  console.error("❌ Fel vid radering:", err);
});