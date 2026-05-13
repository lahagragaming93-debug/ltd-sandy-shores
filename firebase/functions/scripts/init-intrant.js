// Marque intrant=true sur les matieres premieres : acier, cuivre, caoutchouc,
// corde, feve-cacao. Ces produits sont achetes par le LTD pour servir d'intrant
// au craft, mais ne sont JAMAIS revendus.
// Usage : node scripts/init-intrant.js [--apply]
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

const INTRANTS = ['acier', 'cuivre', 'caoutchouc', 'corde', 'feve-cacao'];

for (const id of INTRANTS) {
  const snap = await db.collection('produits').doc(id).get();
  if (!snap.exists) { console.log(`  ⚠ ${id} : produit absent`); continue; }
  const p = snap.data();
  const actuel = !!p.intrant;
  console.log(`  ${id.padEnd(15)} | ${(p.nom || '').padEnd(15)} | intrant: ${actuel} -> true`);
  if (APPLY && !actuel) {
    await snap.ref.set({ intrant: true }, { merge: true });
  }
}

if (!APPLY) console.log('\nRelance avec --apply pour modifier.');
process.exit(0);
