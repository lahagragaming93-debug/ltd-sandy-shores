// Marque les produits avec leur fournisseur connu.
// - Yootool : outillage, electricite, entretien vehicule, jardinage, peche, piles
// - GB Foundry : acier, cuivre
// Usage : node scripts/init-fournisseurs.js [--apply]
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

const MAPPINGS = {
  'Yootool': [
    // Outillage
    'outil', 'perceuse', 'perceuse-manuel', 'grosse-perceuse-rouge',
    'pince-coupante', 'pince-plaque', 'foret-perceuse', 'cisaille', 'corde',
    // Electricite
    'batterie',
    // Entretien vehicule
    'huile', 'huile-shell', 'huile-noire', 'batterie-voiture', 'eponge-voiture',
    // Jardinage
    'fertilisant', 'pot-fleur', 'tas-terre', 'bac-jardinage',
    // Peche & chasse
    'croquette',
    // Piles
    'pile'
  ],
  'GB Foundry': [
    'acier', 'cuivre'
  ]
};

let modifies = 0;
for (const [fournisseur, ids] of Object.entries(MAPPINGS)) {
  console.log(`\n=== ${fournisseur} (${ids.length} produits) ===`);
  for (const id of ids) {
    const snap = await db.collection('produits').doc(id).get();
    if (!snap.exists) { console.log(`  ⚠ ${id} : produit absent du catalogue`); continue; }
    const p = snap.data();
    const actuel = p.fournisseur || '';
    if (actuel === fournisseur) {
      console.log(`  ${id.padEnd(28)} | ${p.nom.padEnd(30)} | déjà OK`);
      continue;
    }
    console.log(`  ${id.padEnd(28)} | ${p.nom.padEnd(30)} | "${actuel}" -> "${fournisseur}"`);
    modifies++;
    if (APPLY) {
      await snap.ref.set({ fournisseur }, { merge: true });
    }
  }
}

console.log(`\nA modifier : ${modifies}`);
if (!APPLY) console.log('Relance avec --apply pour modifier.');
process.exit(0);
