// Yootool — ajustements :
//   - Pile verte (`pile`) : passer en intrant=true (achat interne, jamais vendue)
//   - Croquette (`croquette`) : passer en pourPro=false (vendable particuliers,
//     commission vendeur). Prix d'achat reste a renseigner par le patron.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY-RUN');

const updates = [
  { id: 'pile',      patch: { intrant: true,  pourPro: false, enFabrication: false }, reason: 'Pile verte : achat interne, jamais vendue' },
  { id: 'croquette', patch: { intrant: false, pourPro: false, enFabrication: false }, reason: 'Croquette : vendable particuliers (commission)' }
];

for (const u of updates) {
  const snap = await db.collection('produits').doc(u.id).get();
  if (!snap.exists) { console.log(`  ⚠ ${u.id} : produit absent`); continue; }
  const p = snap.data();
  console.log(`\n${u.id} (${p.nom}) :`);
  console.log(`  Avant : pourPro=${p.pourPro} intrant=${p.intrant} enFabrication=${p.enFabrication}`);
  console.log(`  Après : ${JSON.stringify(u.patch)}`);
  console.log(`  Raison : ${u.reason}`);
  if (APPLY) {
    await snap.ref.set(u.patch, { merge: true });
    console.log('  ✓ mis a jour');
  }
}

if (!APPLY) console.log('\nRelance avec --apply pour modifier.');
process.exit(0);
