// Backfill /produits/{id} : applique le flag pourPro depuis le catalogue
// Usage : node scripts/init-pourpro.js [--apply]
//   Sans --apply : dry-run
//   Avec --apply : modifie Firestore
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

// Liste des 26 produits "particulier" (pourPro: false) — le reste = true
const PARTICULIER_IDS = new Set([
  'grosse-perceuse-rouge', 'foret-perceuse', 'pince-plaque', 'pince-coupante',
  'cisaille', 'ticket-gratter', 'skate-board', 'ballon-foot', 'ballon-basket',
  'canne-peche', 'appat-grande-qualite', 'herisson', 'table', 'pot-fleur',
  'fertilisant', 'tas-terre', 'lumiere-violette', 'bonbon', 'bonbon-tada',
  'bonbon-drag', 'bonbon-cola', 'cola-zero', 'trousseau-clefs',
  'porte-document', 'porte-feuille', 'colle'
]);

const APPLY = process.argv.includes('--apply');
console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY-RUN');
console.log('');

const snap = await db.collection('produits').get();
console.log(`Produits trouves : ${snap.size}\n`);

let modifPart = 0, modifPro = 0, dejaCorrect = 0;
const aTraiter = [];
for (const d of snap.docs) {
  const p = d.data();
  const cibleParticulier = PARTICULIER_IDS.has(d.id);
  const ciblePourPro = !cibleParticulier;
  const actuel = p.pourPro;
  if (actuel === ciblePourPro) {
    dejaCorrect++;
    continue;
  }
  aTraiter.push({ id: d.id, nom: p.nom, actuel, cible: ciblePourPro });
}

console.log(`Deja corrects : ${dejaCorrect}`);
console.log(`A modifier    : ${aTraiter.length}\n`);

for (const t of aTraiter) {
  const dir = t.cible ? '-> PRO' : '-> PARTICULIER';
  console.log(`  ${t.id.padEnd(28)} | ${t.nom.padEnd(35)} | actuel=${t.actuel} ${dir}`);
  if (APPLY) {
    await db.collection('produits').doc(t.id).set({ pourPro: t.cible }, { merge: true });
    if (t.cible) modifPro++;
    else modifPart++;
  }
}

console.log('');
if (APPLY) {
  console.log(`Modifies : ${modifPart} -> particulier, ${modifPro} -> pro`);
} else {
  console.log('Relance avec --apply pour modifier.');
}
process.exit(0);
