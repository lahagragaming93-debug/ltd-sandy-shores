import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const weekKey = '2026-05-11'; // W18

// Lit la fenetre paie depuis le doc /semaines (figee a la cloture)
const semSnap = await db.collection('semaines').doc(weekKey).get();
if (!semSnap.exists) {
  console.error(`/semaines/${weekKey} introuvable. Annulation.`);
  process.exit(1);
}
const sem = semSnap.data();
const debutFenetre = sem.fenetrePaieDebut?.toDate?.();
const finFenetre = sem.fenetrePaieFin?.toDate?.();
if (!debutFenetre || !finFenetre) {
  console.error('Fenetre paie manquante dans le doc semaine. Annulation.');
  process.exit(1);
}

console.log(`Fenetre paie W18 : ${debutFenetre.toLocaleString('fr-FR')} -> ${finFenetre.toLocaleString('fr-FR')}`);

const paiesSnap = await db.collection('paies')
  .where('timestamp', '>=', Timestamp.fromDate(debutFenetre))
  .where('timestamp', '<=', Timestamp.fromDate(finFenetre)).get();

console.log(`${paiesSnap.size} paies trouvees dans la fenetre.`);

let nTag = 0, nSkip = 0;
const batch = db.batch();
paiesSnap.docs.forEach(d => {
  const data = d.data();
  if (data.weekKeyAttribuee === weekKey) {
    nSkip++;
    return;
  }
  batch.update(d.ref, { weekKeyAttribuee: weekKey });
  nTag++;
});
if (nTag > 0) {
  await batch.commit();
}
console.log(`Tag W18 applique : ${nTag} paies | deja tag : ${nSkip}`);

process.exit(0);
