// Backfill : cache les ventes bot Discord qui ont ete remplacees par une
// declaration manuelle (meme vendeur, meme montant, dans les 15 min suivantes).
// Usage : node scripts/backfill-doublons-bot-manuelle.js [--apply]
//   Sans --apply : dry-run (liste les doublons sans modifier)
//   Avec --apply : applique les modifications
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
console.log(APPLY ? 'MODE: APPLY (modifications appliquees)' : 'MODE: DRY-RUN (aucune modification)');
console.log('');

// Liste toutes les ventes manuelles des 30 derniers jours
const trenteJours = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const manSnap = await db.collection('ventes')
  .where('timestamp', '>=', Timestamp.fromDate(trenteJours))
  .orderBy('timestamp', 'asc')
  .get();

const manuelles = manSnap.docs.filter(d => d.data().source === 'manuelle');
console.log(`Ventes manuelles (30 derniers jours) : ${manuelles.length}\n`);

let doublonsTrouves = 0;
let doublonsCaches = 0;

for (const manDoc of manuelles) {
  const m = manDoc.data();
  const mTs = m.timestamp?.toDate ? m.timestamp.toDate() : null;
  if (!mTs) continue;
  // Fenetre +/- 15 min autour de la manuelle (bot peut remonter avant OU apres)
  const debutW = new Date(mTs.getTime() - 15 * 60 * 1000);
  const finW   = new Date(mTs.getTime() + 15 * 60 * 1000);

  const botSnap = await db.collection('ventes')
    .where('timestamp', '>=', Timestamp.fromDate(debutW))
    .where('timestamp', '<=', Timestamp.fromDate(finW))
    .get();

  for (const botDoc of botSnap.docs) {
    const b = botDoc.data();
    // Bot = tout ce qui n'est PAS source='manuelle' (les ventes bot ont
    // historiquement source=undefined, pas 'discord').
    if (b.vendeurId === m.vendeurId &&
        b.source !== 'manuelle' &&
        Number(b.montant) === Number(m.montant) &&
        !b.cachee &&
        botDoc.id !== manDoc.id) {
      doublonsTrouves++;
      const bTs = b.timestamp.toDate().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
      const mTsStr = mTs.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
      console.log(`DOUBLON : ${m.vendeurNom || m.vendeurId}`);
      console.log(`  Bot      : #${b.factureId} | ${bTs} | ${b.montant}$ | benef ${b.benefice}$ | client ${b.client}`);
      console.log(`  Manuelle : #${m.factureId} | ${mTsStr} | ${m.montant}$ | benef ${m.benefice}$ | client ${m.client}`);
      if (APPLY) {
        await botDoc.ref.update({
          cachee: true,
          remplaceeParId: manDoc.id,
          remplaceeParFactureId: m.factureId,
          dateCachage: FieldValue.serverTimestamp()
        });
        doublonsCaches++;
        console.log(`  -> CACHEE`);
      }
      console.log('');
      break;
    }
  }
}

console.log('---');
console.log(`Doublons trouves : ${doublonsTrouves}`);
if (APPLY) console.log(`Doublons caches  : ${doublonsCaches}`);
else console.log(`(Relance avec --apply pour cacher)`);
process.exit(0);
