// Reset : pour toutes les ventes ANTERIEURES au deploiement de la nouvelle
// logique (cutoff = timestamp commit 4248698 = 2026-05-13 18:57:42 +02:00),
// remet `montantParticulier = montant`. Le nouveau calcul (caParticulier) ne
// s'applique qu'aux ventes creees a partir de maintenant.
// Usage : node scripts/reset-particulier-historique.js [--apply]
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
console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY-RUN');

const CUTOFF = new Date('2026-05-13T18:57:42+02:00');
console.log(`Cutoff : ${CUTOFF.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);

// Toutes les ventes avant le cutoff
const ventesSnap = await db.collection('ventes')
  .where('timestamp', '<', Timestamp.fromDate(CUTOFF))
  .get();
console.log(`Ventes anterieures au cutoff : ${ventesSnap.size}\n`);

let modifs = 0;
let dejaCorrect = 0;
let totalRecup = 0;

for (const d of ventesSnap.docs) {
  const v = d.data();
  const montant = Number(v.montant || 0);
  const actuel = Number(v.montantParticulier ?? montant);
  if (actuel === montant) {
    dejaCorrect++;
    continue;
  }
  // L'ecart est ce qu'on "recupere" en commissionnable
  const ecart = montant - actuel;
  totalRecup += ecart;
  modifs++;
  if (APPLY) {
    await d.ref.update({ montantParticulier: montant });
  } else if (modifs <= 10) {
    const ts = v.timestamp?.toDate?.()?.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) || '?';
    console.log(`  ${ts} | #${v.factureId} | ${v.vendeurNom} | montant=${montant} | particulier=${actuel} → ${montant} (+${ecart})`);
  }
}
if (!APPLY && modifs > 10) console.log(`  ... et ${modifs - 10} autres ventes\n`);

console.log(`\nResume :`);
console.log(`  Deja correctes (montantParticulier = montant) : ${dejaCorrect}`);
console.log(`  A modifier (montantParticulier < montant)      : ${modifs}`);
console.log(`  CA "pro" qui repasse en commissionnable        : ${Math.round(totalRecup)} $`);
if (!APPLY) console.log(`\nRelance avec --apply pour modifier.`);
process.exit(0);
