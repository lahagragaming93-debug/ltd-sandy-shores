// Alignement des prix : Filet (vente 10 -> 12.50) + Acier (achat 0 -> 40)
// Usage : node scripts/update-filet-acier.js [--apply]
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
  { id: 'fillet', patch: { prixVente: 12.50 } },
  { id: 'acier',  patch: { prixAchat: 40 } }
];

for (const u of updates) {
  const snap = await db.collection('produits').doc(u.id).get();
  if (!snap.exists) { console.log(`  ⚠ ${u.id} : produit inexistant`); continue; }
  const p = snap.data();
  console.log(`\n${u.id} (${p.nom}) :`);
  for (const [k, v] of Object.entries(u.patch)) {
    console.log(`  ${k}: ${p[k] ?? '(absent)'} -> ${v}`);
  }
  if (APPLY) {
    await snap.ref.set(u.patch, { merge: true });
    console.log('  ✓ mis a jour');
  }
}

if (!APPLY) console.log('\nRelance avec --apply pour modifier.');
process.exit(0);
