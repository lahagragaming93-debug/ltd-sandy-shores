// Recalcul COMPLET d'une semaine /semaines/{weekKey} :
//   - ca = ventes produits + redistributions carburant
//   - depenses = depenses hors type='paie' (doublon avec paies)
//   - chargesDeductibles
//   - masseSalariale = paies dans la fenetre [lundi N+1 00h, mardi N+1 21h]
//   - benefice = ca - depenses - masse
//
// Usage : node scripts/recalc-semaine-complet.js 2026-05-04 --apply

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
if (!weekKey) { console.error('Usage: node scripts/recalc-semaine-complet.js YYYY-MM-DD [--apply]'); process.exit(1); }

const semSnap = await db.collection('semaines').doc(weekKey).get();
if (!semSnap.exists) { console.error(`/semaines/${weekKey} introuvable`); process.exit(1); }
const sem = semSnap.data();
const debut = sem.dateDebut.toDate();
const fin = sem.dateFin.toDate();

const debutFenetre = new Date(fin.getTime() + 1);
debutFenetre.setHours(0, 0, 0, 0);
const finFenetre = new Date(debutFenetre);
finFenetre.setDate(finFenetre.getDate() + 1);
finFenetre.setHours(21, 0, 0, 0);

const [ventesSnap, redisSnap, depSnap, paiesSnap] = await Promise.all([
  db.collection('ventes')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
  db.collection('redistributions')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
  db.collection('depenses')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
  db.collection('paies')
    .where('timestamp', '>=', Timestamp.fromDate(debutFenetre))
    .where('timestamp', '<=', Timestamp.fromDate(finFenetre)).get()
]);

const caProduits = ventesSnap.docs.reduce((s, d) => s + (d.data().montant || 0), 0);
const caCarburant = redisSnap.docs.reduce((s, d) => s + (Number(d.data().montant) || 0), 0);
const ca = caProduits + caCarburant;
const benefice = ventesSnap.docs.reduce((s, d) => s + (d.data().benefice || 0), 0);

const depensesReelles = depSnap.docs.filter(d => d.data().type !== 'paie');
const depTotal = depensesReelles.reduce((s, d) => s + (d.data().montant || 0), 0);
const dedu = depensesReelles.filter(d => d.data().deductible !== false)
  .reduce((s, d) => s + (d.data().montant || 0), 0);

const masse = paiesSnap.docs.reduce((s, d) => s + (d.data().montant || 0), 0);
const beneficeNet = ca - depTotal - masse;

console.log(`Semaine ${weekKey} (${debut.toISOString().slice(0,10)} -> ${fin.toISOString().slice(0,10)})`);
console.log(`AVANT :`);
console.log(`  ca=${sem.ca || 0} (produits=${sem.caProduits || '?'} carb=${sem.caCarburant || '?'})`);
console.log(`  depenses=${sem.depenses || 0}  dedu=${sem.chargesDeductibles || 0}`);
console.log(`  masseSalariale=${sem.masseSalariale || 0}`);
console.log(`  benefice=${sem.benefice || 0}`);
console.log(`APRES :`);
console.log(`  ca=${ca} (produits=${caProduits} carb=${caCarburant}) [${ventesSnap.size}v + ${redisSnap.size}r]`);
console.log(`  depenses=${depTotal}  dedu=${dedu} [${depensesReelles.length} entries hors paie / ${depSnap.size} total]`);
console.log(`  masseSalariale=${masse} [${paiesSnap.size} paies dans fenetre post-cloture]`);
console.log(`  benefice=${beneficeNet}`);

if (!APPLY) { console.log('\nDry-run. --apply pour ecrire.'); process.exit(0); }

await db.collection('semaines').doc(weekKey).set({
  ca, caProduits, caCarburant,
  beneficeBrut: benefice,
  depenses: depTotal,
  chargesDeductibles: dedu,
  masseSalariale: masse,
  benefice: beneficeNet,
  nbVentes: ventesSnap.size + redisSnap.size,
  nbDepenses: depensesReelles.length,
  statut: 'cloturee',
  fenetrePaieDebut: Timestamp.fromDate(debutFenetre),
  fenetrePaieFin: Timestamp.fromDate(finFenetre),
  dateClotureFinale: FieldValue.serverTimestamp(),
  recalculPar: 'recalc-semaine-complet.js'
}, { merge: true });
console.log('Done.');
process.exit(0);
