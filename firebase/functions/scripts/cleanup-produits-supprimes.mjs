// ============================================================
// One-shot : retire pioche / sac-jute / fillet du catalogue Firestore
// + retire le champ quotaFabrication.pioche de config/global
// ============================================================
// Decision patron 2026-05-25 : ces 3 produits ne seront jamais
// fabriques. On les retire du catalogue, des stocks, et du quota
// fab.
//
// Usage :
//   cd firebase/functions
//   node scripts/cleanup-produits-supprimes.mjs          → dry-run
//   node scripts/cleanup-produits-supprimes.mjs --apply  → ecrit
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY     = process.argv.includes('--apply');

const IDS = ['pioche', 'sac-jute', 'fillet'];

initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });
const db = getFirestore();

console.log('[cleanup-produits-supprimes] mode :', APPLY ? 'APPLY' : 'DRY-RUN');
console.log('[cleanup-produits-supprimes] ids  :', IDS.join(', '));
console.log('');

// Pre-fetch en parallele : 3 produits + 3 stocks + config en 1 round-trip groupe.
const [produitsSnaps, stocksSnaps, cfgSnap] = await Promise.all([
  Promise.all(IDS.map(id => db.collection('produits').doc(id).get())),
  Promise.all(IDS.map(id => db.collection('stocks').doc(id).get())),
  db.collection('config').doc('global').get()
]);

IDS.forEach((id, i) => {
  const pExist = produitsSnaps[i].exists;
  const sExist = stocksSnaps[i].exists;
  const qte = sExist ? (stocksSnaps[i].data().quantite ?? '?') : '-';
  console.log(`  ${id.padEnd(20)} produit:${pExist ? 'OUI' : 'NON'}  stock:${sExist ? `${qte} u.` : 'NON'}`);
});

const qFab = cfgSnap.exists ? (cfgSnap.data().quotaFabrication || {}) : {};
console.log('');
console.log('[cleanup-produits-supprimes] config.quotaFabrication actuel :', JSON.stringify(qFab));

if (!APPLY) {
  console.log('');
  console.log('[cleanup-produits-supprimes] dry-run termine. Ajoute --apply pour ecrire.');
  process.exit(0);
}

// === APPLY ===
const batch = db.batch();
for (const id of IDS) {
  batch.delete(db.collection('produits').doc(id));
  batch.delete(db.collection('stocks').doc(id));
}
// Retire le champ pioche du quotaFabrication
batch.update(db.collection('config').doc('global'), {
  'quotaFabrication.pioche': FieldValue.delete()
});

await batch.commit();
console.log('');
console.log('[cleanup-produits-supprimes] OK : 3 produits + 3 stocks supprimes, config.quotaFabrication.pioche retire.');
process.exit(0);
