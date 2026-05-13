// Supprime les 6 depenses erronees saisies par Blake le 12/05/2026 23:41-23:42
// Usage : node scripts/supprimer-depenses-blake-erreur.js [--apply]
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
console.log(APPLY ? 'MODE: APPLY (suppression definitive)' : 'MODE: DRY-RUN');

// Fenetre 12/05 23:40 -> 23:43 Europe/Paris
const debut = new Date('2026-05-12T23:40:00+02:00');
const fin   = new Date('2026-05-12T23:43:00+02:00');
console.log(`Fenetre : ${debut.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} - ${fin.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);

const snap = await db.collection('depenses')
  .where('timestamp', '>=', Timestamp.fromDate(debut))
  .where('timestamp', '<=', Timestamp.fromDate(fin))
  .get();

const MONTANTS_ATTENDUS = new Set([350, 40, 25000, 694, 20000, 238]);
const cibles = [];
for (const d of snap.docs) {
  const v = d.data();
  const montant = Number(v.montant || 0);
  const raison = String(v.raison || '');
  if (MONTANTS_ATTENDUS.has(montant) && raison.toLowerCase().includes('mati')) {
    cibles.push({ id: d.id, ref: d.ref, ...v });
  }
}

console.log(`\nCandidats : ${cibles.length}`);
let total = 0;
for (const c of cibles) {
  const ts = c.timestamp?.toDate?.()?.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) || '?';
  total += Number(c.montant || 0);
  console.log(`  ${ts} | id=${c.id} | -${c.montant} \$ | ${c.raison} | par ${c.utilisateur || '?'}`);
}
console.log(`\nTotal a supprimer : ${total} \$`);

if (APPLY) {
  for (const c of cibles) {
    await c.ref.delete();
  }
  console.log(`\n✓ ${cibles.length} depenses supprimees.`);
} else {
  console.log('\nRelance avec --apply pour supprimer.');
}
process.exit(0);
