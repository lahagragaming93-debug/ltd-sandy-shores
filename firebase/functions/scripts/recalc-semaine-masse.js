// Recalcule masseSalariale d'une semaine /semaines/{weekKey} en lisant les
// paies dans la fenetre [lundi N+1 00h, mardi N+1 21h] (regle post-cloture).
// Utile pour rattraper les docs /semaines crees AVANT que la cloture en
// 2 etapes soit deployee.
//
// Usage : node scripts/recalc-semaine-masse.js 2026-05-04 [--apply]

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const weekKey = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!weekKey) {
  console.error('Usage: node scripts/recalc-semaine-masse.js YYYY-MM-DD [--apply]');
  process.exit(1);
}

const semSnap = await db.collection('semaines').doc(weekKey).get();
if (!semSnap.exists) {
  console.error(`/semaines/${weekKey} introuvable`);
  process.exit(1);
}
const sem = semSnap.data();
const debut = sem.dateDebut.toDate();
const fin = sem.dateFin.toDate();

// Fenetre paie post-cloture
const debutFenetre = new Date(fin.getTime() + 1);
debutFenetre.setHours(0, 0, 0, 0);
const finFenetre = new Date(debutFenetre);
finFenetre.setDate(finFenetre.getDate() + 1);
finFenetre.setHours(21, 0, 0, 0);

console.log(`Semaine ${weekKey}`);
console.log(`  Periode RP : ${debut.toISOString().slice(0,10)} -> ${fin.toISOString().slice(0,10)}`);
console.log(`  Fenetre paie : ${debutFenetre.toISOString()} -> ${finFenetre.toISOString()}`);

const paiesSnap = await db.collection('paies')
  .where('timestamp', '>=', Timestamp.fromDate(debutFenetre))
  .where('timestamp', '<=', Timestamp.fromDate(finFenetre)).get();

console.log(`  ${paiesSnap.size} paies trouvees dans la fenetre`);
let masse = 0;
paiesSnap.forEach(d => {
  const p = d.data();
  masse += p.montant || 0;
  console.log(`    ${p.timestamp?.toDate?.()?.toISOString()} ${p.montant}$ ${p.beneficiaireNom || p.beneficiaireDiscord}`);
});

const beneficeNet = (sem.ca || 0) - (sem.depenses || 0) - masse;

console.log(`\nAVANT : masse=${sem.masseSalariale || 0}$  benefice=${sem.benefice || 0}$`);
console.log(`APRES : masse=${masse}$  benefice=${beneficeNet}$`);

if (!APPLY) {
  console.log('\nDry-run. Ajoute --apply pour ecrire.');
  process.exit(0);
}

await db.collection('semaines').doc(weekKey).set({
  masseSalariale: masse,
  benefice: beneficeNet,
  statut: 'cloturee',
  fenetrePaieDebut: Timestamp.fromDate(debutFenetre),
  fenetrePaieFin: Timestamp.fromDate(finFenetre),
  dateClotureFinale: FieldValue.serverTimestamp(),
  recalculPar: 'recalc-semaine-masse.js'
}, { merge: true });
console.log('Done.');
process.exit(0);
