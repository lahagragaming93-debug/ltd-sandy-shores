// Verification finale apres marquage : la subvention remonte-t-elle bien
// dans la fenetre de la semaine en cours ?
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const debut = new Date('2026-05-11T00:00:00+02:00');
const fin   = new Date('2026-05-18T00:00:00+02:00');

// Meme requete que listSubventionsSemaine cote frontend
const snap = await db.collection('banqueLtd')
  .where('timestamp', '>=', Timestamp.fromDate(debut))
  .where('timestamp', '<=', Timestamp.fromDate(fin))
  .orderBy('timestamp', 'desc')
  .get();

const subv = snap.docs
  .map(d => ({ id: d.id, ...d.data() }))
  .filter(b => b.categorieEntree === 'subvention');

console.log(`Subventions detectees dans la fenetre semaine S20 : ${subv.length}`);
let tot = 0;
for (const s of subv) {
  const ts = s.timestamp?.toDate?.()?.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) || '?';
  console.log(`  ${ts}  +${s.montant} $  "${s.raison}"  cat=${s.categorieEntree}`);
  tot += Number(s.montant);
}
console.log(`Total : ${tot} $`);

// Recalcul de la compta semaine S20 avec la subvention
console.log('');
console.log('=== Compta recalculee semaine S20 (avec subvention) ===');
const [ventesSnap, redistSnap, depSnap, paiesSnap] = await Promise.all([
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
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
]);

const ca = ventesSnap.docs
  .map(d => d.data())
  .filter(v => !v.cachee)
  .reduce((s, v) => s + (Number(v.montant) || 0), 0);
const caCarburant = redistSnap.docs.reduce((s, d) => s + (Number(d.data().montant) || 0), 0);
const depHorsPaie = depSnap.docs.map(d => d.data()).filter(d => d.type !== 'paie');
const totalDepenses = depHorsPaie.reduce((s, d) => s + (Number(d.montant) || 0), 0);
const dedu = depHorsPaie.filter(d => d.deductible !== false).reduce((s, d) => s + (Number(d.montant) || 0), 0);
const masse = paiesSnap.docs.reduce((s, d) => s + (Number(d.data().montant) || 0), 0);

const caTotal = ca + caCarburant;
const resultatImposable = caTotal - dedu;
const beneficeNet = caTotal + tot - totalDepenses - masse;

console.log(`CA produits        : ${ca} $`);
console.log(`CA carburant       : ${caCarburant} $`);
console.log(`CA imposable       : ${caTotal} $`);
console.log(`Subventions recues : ${tot} $  (non imposable)`);
console.log(`Tresorerie totale  : ${caTotal + tot} $`);
console.log(`Charges deductibles: ${dedu} $`);
console.log(`Total depenses     : ${totalDepenses} $`);
console.log(`Masse salariale    : ${masse} $`);
console.log(`Resultat imposable : ${resultatImposable} $`);
console.log(`BENEFICE NET       : ${beneficeNet} $   (${beneficeNet >= 0 ? '+' : ''}${beneficeNet})`);

process.exit(0);
