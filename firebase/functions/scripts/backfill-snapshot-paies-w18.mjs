// ============================================================
// Backfill : snapshots /paiesEstimees pour la W18 (2026-05-11)
// ============================================================
// Cree retroactivement les snapshots d'estimation salaire pour la W18,
// deja cloturee avant le deploiement de la feature Option B (2026-05-18).
//
// Idempotent : si le doc {weekKey}_{userId} existe deja, skip.
//
// Pre-requis : firebase/serviceAccountKey.json (cle service account admin).
// Lancement :  node firebase/functions/scripts/backfill-snapshot-paies-w18.mjs
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { snapshotPaiesEstimees } from '../lib/paie-calc.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const weekKey = '2026-05-11'; // W18 (lundi)

console.log(`=== Backfill snapshots /paiesEstimees pour W18 (${weekKey}) ===\n`);

// Lit les bornes EXACTES depuis /semaines/{weekKey} (figees a la cloture
// manuelle ou cron, donc deja en UTC correspondant a la realite). Si on
// recalcule cote script, on risque de derive timezone (le serveur tourne
// en UTC mais la semaine RP est Europe/Paris).
const semSnap = await db.collection('semaines').doc(weekKey).get();
if (!semSnap.exists) {
  console.error(`/semaines/${weekKey} introuvable. Annulation.`);
  process.exit(1);
}
const sem = semSnap.data();
const debut = sem.dateDebut?.toDate?.();
const fin = sem.dateFin?.toDate?.();
if (!debut || !fin) {
  console.error('dateDebut/dateFin manquant dans le doc semaine. Annulation.');
  process.exit(1);
}

console.log(`Fenetre semaine : ${debut.toLocaleString('fr-FR')} -> ${fin.toLocaleString('fr-FR')}\n`);

const result = await snapshotPaiesEstimees({
  db, FieldValue, Timestamp, weekKey, debut, fin
});

console.log('\n=== Resultat ===');
console.log(JSON.stringify(result, null, 2));

if (result.errors > 0) {
  console.warn(`\n${result.errors} erreurs — voir logs ci-dessus.`);
}

// Recap : liste les snapshots crees avec montant
console.log('\n=== Snapshots crees ===');
const snaps = await db.collection('paiesEstimees')
  .where('weekKey', '==', weekKey).get();
const lignes = snaps.docs.map(d => d.data())
  .sort((a, b) => (b.montantEstime || 0) - (a.montantEstime || 0));
let total = 0;
for (const sn of lignes) {
  console.log(
    `  ${(sn.prenom + ' ' + sn.nom).padEnd(28)} ` +
    `${(sn.role || '').padEnd(24)} ` +
    `${String(sn.montantEstime || 0).padStart(8)} $ ` +
    `${sn.paye ? '[VERSE]' : '[a verser]'}`
  );
  total += Number(sn.montantEstime) || 0;
}
console.log(`  ${''.padEnd(28)} ${'TOTAL'.padStart(24)} ${String(total).padStart(8)} $`);

console.log('\nDone.');
process.exit(0);
