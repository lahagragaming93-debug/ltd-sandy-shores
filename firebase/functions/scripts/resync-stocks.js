// ============================================================
// Script de RESYNC des stocks LTD (SET absolu, pas increment)
// ============================================================
// Force la quantite de chaque item liste ci-dessous en fonction du
// comptage manuel des coffres IG (screens copatronne 2026-05-XX).
// Ecrase la valeur actuelle dans /stocks/{id}.quantite. Les
// mouvementsStock historiques sont CONSERVES.
// ============================================================
// Usage :
//   1. Remplir le tableau STOCKS ci-dessous (id catalogue + qty reelle IG)
//   2. cd firebase/functions
//   3. node scripts/resync-stocks.js          → dry-run (affiche sans ecrire)
//   4. node scripts/resync-stocks.js --apply  → execute le SET Firestore
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY     = process.argv.includes('--apply');

// ============================================================
// === ZONE A REMPLIR : comptage manuel des coffres LTD ========
// ============================================================
// Format : { id: 'id-catalogue', nom: 'Nom display', qty: NOMBRE_REEL }
// - id : doit correspondre a un id du catalogue (cf. public/js/data/produits.js)
// - qty : somme totale toutes positions du coffre + sous-coffres
// - Si un item n'apparait pas ici, son /stocks/{id} reste inchange.
// ============================================================

const STOCKS = [
  // --- Epicerie (action-27310) ---
  // { id: 'bouteille-eau',           nom: "Bouteille d'eau",         qty: 0 },
  // { id: 'milkshake-proteine',      nom: 'Milkshake protéiné',      qty: 0 },
  // ...

  // --- Materiel (action-27166) ---
  // { id: 'spray-tag',               nom: 'Spray à tag',             qty: 0 },
  // { id: 'ballon-basket',           nom: 'Ballon de Basket',        qty: 0 },
  // ...

  // --- Entrepot (action-30439) ---
  // { id: 'caoutchouc',              nom: 'Caoutchouc',              qty: 0 },
  // { id: 'cuivre',                  nom: 'Cuivre',                  qty: 0 },
  // ...
];

// ============================================================

function loadServiceAccount() {
  try {
    return JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
  } catch (err) {
    console.error(`\nImpossible de lire ${KEY_PATH}`);
    console.error(`Telecharge la cle depuis Firebase Console > Project Settings > Service accounts.`);
    console.error(`Erreur: ${err.message}\n`);
    process.exit(1);
  }
}

async function main() {
  const total = STOCKS.length;

  if (total === 0) {
    console.log('Aucun item a resync. Remplir la zone STOCKS dans le script.');
    process.exit(0);
  }

  const totalQty = STOCKS.reduce((s, x) => s + x.qty, 0);

  console.log('='.repeat(60));
  console.log(`Resync stocks Firestore — ${APPLY ? 'APPLY' : 'DRY-RUN (utilise --apply pour ecrire)'}`);
  console.log('='.repeat(60));
  console.log(`${total} items a resync, ${totalQty.toLocaleString('fr-FR')} unites au total`);
  console.log('Mode: SET ABSOLU (ecrase la valeur actuelle)');
  console.log('');

  if (!APPLY) {
    for (const s of STOCKS) {
      console.log(`  ${s.id.padEnd(28)} = ${String(s.qty).padStart(6)}   (${s.nom})`);
    }
    console.log('\nDry-run termine. Relance avec --apply pour executer.');
    process.exit(0);
  }

  const sa = loadServiceAccount();
  initializeApp({
    credential: cert(sa),
    projectId: sa.project_id
  });
  const db = getFirestore();

  let okCount  = 0;
  let errCount = 0;
  for (const s of STOCKS) {
    try {
      await db.collection('stocks').doc(s.id).set({
        quantite: s.qty,
        nom: s.nom,
        derniereMaj: FieldValue.serverTimestamp(),
        par: 'resync-script'
      }, { merge: true });
      okCount++;
      process.stdout.write(`. `);
    } catch (err) {
      errCount++;
      console.error(`\nERR ${s.id}: ${err.message}`);
    }
  }
  console.log(`\n\nDone: ${okCount} ecrits, ${errCount} erreurs.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
