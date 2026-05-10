// ============================================================
// Reset stockActuel = 0 sur les stations sans essence
// ============================================================
// Patron a confirme : actuellement seules 3 stations ont de
// l'essence (Panorama 16060, Palomino 16513, Senora 35489).
// Les 5 autres doivent avoir stockActuel = 0.
// (Le parser stations-dashboard re-ecrira automatiquement la
// valeur si #⛽-Station envoie un nouveau message — pas un
// probleme, on synchronise juste l'etat affiche maintenant.)
// ============================================================
// Usage :
//   node scripts/reset-stocks-vides.js --apply
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');

const VIDES = [
  'algonquin-boulevard',
  'cholla-springs-avenue',
  'clinton-avenue-vinewood',
  'route-68',
  'route-68-ltd'
];

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

console.log('='.repeat(60));
console.log(`Reset stocks vides — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log('='.repeat(60));

for (const id of VIDES) {
  const snap = await db.collection('stations').doc(id).get();
  if (!snap.exists) { console.log(`  ⚠ ${id} : station inexistante`); continue; }
  const cur = snap.data();
  const ancien = cur.stockActuel ?? 0;
  console.log(`  ${id.padEnd(40)} ${String(ancien).padStart(5)} L → 0 L`);
  if (APPLY) {
    await db.collection('stations').doc(id).set({ stockActuel: 0 }, { merge: true });
  }
}

if (!APPLY) console.log('\nDry-run. Relance avec --apply.');
else console.log('\nDone.');
process.exit(0);
