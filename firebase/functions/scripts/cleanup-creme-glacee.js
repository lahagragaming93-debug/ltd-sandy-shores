// ============================================================
// Script one-shot : cleanup de l'ancien doc 'creme-glacee'
// ============================================================
// Le 2026-05-10, le catalogue a split 'creme-glacee' en deux items
// distincts ('creme-glacee-pot' pour `sourcream` et 'creme-glacee-cornet'
// pour `icecream`). L'ancien doc Firestore devient orphelin (plus
// présent dans le catalogue, donc invisible côté UI mais toujours en
// base). Ce script le supprime proprement.
//
// Les anciens mouvementsStock référençant 'creme-glacee' sont conservés
// (l'historique reste intact), seuls les docs /stocks et /produits sont
// supprimés.
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/cleanup-creme-glacee.js          → dry-run
//   node scripts/cleanup-creme-glacee.js --apply  → suppression effective
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY     = process.argv.includes('--apply');
const TARGET_ID = 'creme-glacee';

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

async function run() {
  console.log(`Mode: ${APPLY ? 'APPLY (suppression effective)' : 'DRY-RUN'}`);
  console.log(`Cible: docs avec id="${TARGET_ID}" dans /stocks et /produits\n`);

  const collections = ['stocks', 'produits'];
  let totalToDelete = 0;
  let totalDeleted  = 0;

  for (const coll of collections) {
    const ref = db.collection(coll).doc(TARGET_ID);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  /${coll}/${TARGET_ID} : absent (rien à faire)`);
      continue;
    }
    totalToDelete++;
    console.log(`  /${coll}/${TARGET_ID} : trouvé`);
    console.log('    Données :', JSON.stringify(snap.data(), null, 2));
    if (APPLY) {
      await ref.delete();
      totalDeleted++;
      console.log(`    → SUPPRIMÉ`);
    } else {
      console.log(`    → serait supprimé (dry-run)`);
    }
  }

  console.log(`\nRésumé : ${totalToDelete} doc(s) à supprimer, ${totalDeleted} effectivement supprimé(s).`);
  if (!APPLY && totalToDelete > 0) {
    console.log(`Relancer avec --apply pour exécuter.`);
  }
}

run().catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});
