// ============================================================
// Cleanup : supprime tous les docs /redistributions
// ============================================================
// Utile avant de relancer rattraper-redistributions.js avec une
// nouvelle version du parser (ex: passage des prix arrondis aux
// prix avec centimes le 2026-05-10).
//
// IMPORTANT : ne touche PAS aux stations ni aux mouvementsStock.
// Seule la collection /redistributions est purgee.
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/cleanup-redistributions.js          dry-run
//   node scripts/cleanup-redistributions.js --apply  suppression effective
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY     = process.argv.includes('--apply');

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

async function run() {
  console.log(`Mode: ${APPLY ? 'APPLY (suppression effective)' : 'DRY-RUN'}\n`);

  const snap = await db.collection('redistributions').get();
  console.log(`Trouve ${snap.size} docs dans /redistributions`);

  if (snap.size === 0) {
    console.log('Rien a supprimer.');
    return;
  }

  if (!APPLY) {
    console.log(`\nDry-run termine. Relance avec --apply pour supprimer les ${snap.size} docs.`);
    return;
  }

  // Suppression par batch de 500 (limite Firestore)
  let deleted = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    const slice = docs.slice(i, i + 500);
    slice.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += slice.length;
    process.stdout.write(`. (${deleted}/${docs.length}) `);
  }
  console.log(`\n\nSupprime : ${deleted} docs.`);
}

run().catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});
