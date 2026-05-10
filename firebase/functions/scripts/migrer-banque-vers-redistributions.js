// ============================================================
// Migration /banqueLtd -> /redistributions
// ============================================================
// Pour la periode anterieure a la mise en place du canal Discord
// #suivi-achat-essence, les ventes carburant n'ont JAMAIS ete postees
// avec leur detail (station, litres, prix). Seules les entrees bancaires
// xbankaccount sont arrivees dans /banqueLtd avec raison "Redistribution
// N°XXXXX".
//
// Ce script reconstruit des docs /redistributions MINIMAUX a partir de
// ces entrees, pour que la page Revenus carburant affiche au moins le
// CA dans son graphique.
//
// LIMITES :
//  - station = "Station inconnue (migration)" (non capturable)
//  - stationId = "station-inconnue-migration"
//  - litres = 0, prixLitre = 0, stockAvant/Apres = 0
//  - Le recap "par station" sera toutes ces ventes regroupees sous
//    "Station inconnue", et le prix moyen/L sera 0$.
//  - Le graphique CA par jour sera juste, c'est le but.
//
// IDEMPOTENT :
//  - On indexe d'abord les redistributionId deja presents dans
//    /redistributions et on skip ceux-la (evite doublons avec
//    rattraper-redistributions.js qui utilise les vraies donnees Discord).
//  - DocId = `mig-${banqueDocId}` pour traceabilite.
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/migrer-banque-vers-redistributions.js          dry-run
//   node scripts/migrer-banque-vers-redistributions.js --apply  ecrit
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY     = process.argv.includes('--apply');

const STATION_PLACEHOLDER   = 'Station inconnue (migration)';
const STATION_ID_PLACEHOLDER = 'station-inconnue-migration';
const REGEX_REDIST = /redistribution\s*n[°º]?\s*(\d+)/i;

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

async function run() {
  console.log(`Mode: ${APPLY ? 'APPLY (ecrit dans /redistributions)' : 'DRY-RUN'}\n`);

  // 1) Indexer les redistributionId deja presents dans /redistributions
  console.log('Lecture /redistributions existant...');
  const redisSnap = await db.collection('redistributions').get();
  const existingIds = new Set();
  for (const d of redisSnap.docs) {
    const data = d.data();
    if (data.redistributionId) existingIds.add(String(data.redistributionId));
  }
  console.log(`  ${existingIds.size} redistributionId deja presents (seront skippes)\n`);

  // 2) Lire /banqueLtd et filtrer les entrees "Redistribution N°..."
  console.log('Lecture /banqueLtd...');
  const banqueSnap = await db.collection('banqueLtd').get();
  console.log(`  ${banqueSnap.size} entrees totales\n`);

  let candidates = 0;
  let toMigrate  = 0;
  let skippedExisting = 0;
  let skippedNoMatch  = 0;
  const operations = [];

  for (const d of banqueSnap.docs) {
    const data = d.data();
    const raison = String(data.raison || '');
    const m = raison.match(REGEX_REDIST);
    if (!m) continue; // pas une redistribution
    candidates++;

    // Seules les ENTREES (type='add') sont des recettes carburant
    if (data.type !== 'add') continue;

    const redistId = m[1];
    if (existingIds.has(redistId)) {
      skippedExisting++;
      continue;
    }

    const docId = `mig-${d.id}`;
    operations.push({
      docId,
      redistId,
      banqueDocId: d.id,
      timestamp: data.timestamp,
      montant: Number(data.montant) || 0,
      raison
    });
    toMigrate++;
  }

  skippedNoMatch = banqueSnap.size - candidates;

  console.log(`Resume :`);
  console.log(`  ${skippedNoMatch} entrees sans 'Redistribution N°' (ignorees)`);
  console.log(`  ${candidates} entrees 'Redistribution' trouvees`);
  console.log(`  ${skippedExisting} skippees (redistributionId deja present)`);
  console.log(`  ${toMigrate} a migrer\n`);

  if (toMigrate === 0) {
    console.log('Rien a faire.');
    return;
  }

  // Affichage des 5 premiers + 5 derniers pour aperçu
  const preview = operations.length <= 10
    ? operations
    : [...operations.slice(0, 5), null, ...operations.slice(-5)];
  for (const op of preview) {
    if (op === null) { console.log(`  ... (${operations.length - 10} autres) ...`); continue; }
    const dateStr = op.timestamp?.toDate?.()?.toISOString?.()?.slice(0, 16)?.replace('T', ' ') || '????';
    console.log(`  ${dateStr}  N°${op.redistId.padEnd(7)} ${op.montant.toString().padStart(6)} $`);
  }

  if (!APPLY) {
    console.log(`\nDry-run termine. Relance avec --apply pour ecrire ${toMigrate} docs.`);
    return;
  }

  // 3) Ecriture par batch de 500
  console.log(`\nEcriture en cours...`);
  let written = 0;
  for (let i = 0; i < operations.length; i += 500) {
    const batch = db.batch();
    const slice = operations.slice(i, i + 500);
    for (const op of slice) {
      const ref = db.collection('redistributions').doc(op.docId);
      batch.set(ref, {
        redistributionId: op.redistId,
        station: STATION_PLACEHOLDER,
        stationId: STATION_ID_PLACEHOLDER,
        litres: 0,
        prixLitre: 0,
        montant: op.montant,
        stockAvant: 0,
        stockApres: 0,
        niveau: 0,
        timestamp: op.timestamp,
        source: 'migration-banqueLtd',
        sourceBanqueDocId: op.banqueDocId
      });
    }
    await batch.commit();
    written += slice.length;
    process.stdout.write(`. (${written}/${operations.length}) `);
  }
  console.log(`\n\nDone : ${written} docs ecrits dans /redistributions.`);
  console.log(`\nA savoir : ces docs ont station="${STATION_PLACEHOLDER}" et litres/prix=0.`);
  console.log(`Le recap par station les regroupera tous, mais le graphique CA par jour sera juste.`);
}

run().catch(err => {
  console.error('Erreur :', err);
  process.exit(1);
});
