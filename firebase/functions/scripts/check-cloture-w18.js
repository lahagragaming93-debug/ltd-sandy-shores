import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const weekKey = '2026-05-11';
const snap = await db.collection('semaines').doc(weekKey).get();
if (!snap.exists) {
  console.log(`❌ Doc /semaines/${weekKey} N'EXISTE PAS`);
  process.exit(0);
}
const d = snap.data();
const fmt = (v) => v == null ? '—' : (typeof v === 'number' ? v.toLocaleString('fr-FR') + ' $' : String(v));
const fmtTs = (t) => t?.toDate?.()?.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) || '—';

console.log(`\n=== /semaines/${weekKey} ===\n`);
console.log(`Statut              : ${d.statut}`);
console.log(`Cloture manuelle    : ${d.clotureManuelle || false}`);
console.log(`Cloture par         : ${d.cloturParNom || d.cloturePar || '—'}`);
console.log(`Date cloture manu   : ${fmtTs(d.dateClotureManuelle)}`);
console.log(`Date cloture finale : ${fmtTs(d.dateClotureFinale)}`);
console.log(`Date cloture etape1 : ${fmtTs(d.dateCloture)}`);
console.log(`Note cloture        : ${d.noteCloture || '—'}`);
console.log(`Confirmation IRS    : ${d.confirmationIRS || false}`);
console.log(``);
console.log(`Date debut sem      : ${fmtTs(d.dateDebut)}`);
console.log(`Date fin sem        : ${fmtTs(d.dateFin)}`);
console.log(`Fenetre paie debut  : ${fmtTs(d.fenetrePaieDebut)}`);
console.log(`Fenetre paie fin    : ${fmtTs(d.fenetrePaieFin)}`);
console.log(``);
console.log(`CA total            : ${fmt(d.ca)}`);
console.log(`  CA produits       : ${fmt(d.caProduits)}`);
console.log(`  CA carburant      : ${fmt(d.caCarburant)}`);
console.log(`Benefice brut       : ${fmt(d.beneficeBrut)}`);
console.log(`Depenses (hors paie): ${fmt(d.depenses)}`);
console.log(`Charges deductibles : ${fmt(d.chargesDeductibles)}`);
console.log(`Masse salariale     : ${fmt(d.masseSalariale)}`);
console.log(`Benefice NET        : ${fmt(d.beneficeNet || d.benefice)}`);
console.log(`Nb ventes           : ${fmt(d.nbVentes)}`);
console.log(`Nb depenses         : ${fmt(d.nbDepenses)}`);

process.exit(0);
