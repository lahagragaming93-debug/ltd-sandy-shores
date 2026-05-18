// ============================================================
// Backfill : onglet Sheet snapshot pour la W20 (2026-05-11)
// ============================================================
// Cree l'onglet "Semaine 20 (11-17 mai 2026)" dans le Sheet Comptabilite
// pour la semaine deja cloturee le 18/05/2026 (avant le deploiement de la
// feature snapshot-sheet-semaine).
//
// Idempotent : si l'onglet existe deja, son contenu est reecrit.
//
// Pre-requis :
//  - firebase/serviceAccountKey.json (cle service account admin)
//  - Le compte service doit avoir acces edition au Sheet (SHEET_ID).
//
// Lancement :
//   node firebase/functions/scripts/backfill-snapshot-sheet-semaine-w20.mjs
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { snapshotSheetSemaine } from '../lib/snapshot-sheet-semaine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const saPath = resolve(__dirname, '../../serviceAccountKey.json');
const sa = JSON.parse(readFileSync(saPath, 'utf-8'));

initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

// Client Sheets : meme service account que pour l'admin Firestore — il doit
// avoir ete partage en edition sur le Sheet (cf. setup DASHBOARD_SA_KEY).
const auth = new google.auth.GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

const weekKey = '2026-05-11'; // W20 (lundi)

console.log(`=== Backfill snapshot Sheet onglet pour W20 (${weekKey}) ===\n`);

// Lit les bornes EXACTES depuis /semaines/{weekKey} (figees a la cloture
// donc deja en UTC reel correspondant a lundi 00h00 / dim 23h59 Paris).
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

console.log(`Fenetre semaine : ${debut.toLocaleString('fr-FR')} -> ${fin.toLocaleString('fr-FR')}`);
console.log(`CA total       : ${sem.ca || 0} $`);
console.log(`Benefice net   : ${sem.beneficeNet ?? sem.benefice ?? 0} $`);
console.log(`Masse salariale: ${sem.masseSalariale || 0} $\n`);

const result = await snapshotSheetSemaine({
  db, sheets, weekKey,
  weekDebut: debut, weekFin: fin,
  semaineData: sem
});

console.log('\n=== Resultat ===');
console.log(JSON.stringify(result, null, 2));
console.log(`\nOnglet "${result.sheetTitle}" ${result.status} (sheetId=${result.sheetId}).`);
console.log(`Lignes ecrites : ${result.rowsWritten}`);
console.log('\nDone.');
process.exit(0);
