// Identifie la transaction "Transfert N°6087 -> N°73830" du 14/05/2026 11:51
// et la marque comme subvention (non imposable, remboursable via contrat).
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

// Plage temps du virement (14/05 09h-14h pour ne rien rater)
const debut = new Date('2026-05-14T09:00:00');
const fin   = new Date('2026-05-14T14:00:00');
const MONTANT = 790000;

const snap = await db.collection('banqueLtd')
  .where('timestamp', '>=', Timestamp.fromDate(debut))
  .where('timestamp', '<=', Timestamp.fromDate(fin))
  .orderBy('timestamp', 'desc')
  .get();

console.log(`${snap.size} transactions dans la plage 14/05 09h-14h`);

let trouve = null;
for (const d of snap.docs) {
  const b = d.data();
  if (b.type !== 'add') continue;
  if (Number(b.montant) !== MONTANT) continue;
  if (b.iban !== 'LTDSANDY') continue;
  trouve = { id: d.id, ref: d.ref, ...b };
  break;
}

if (!trouve) {
  // Cherche plus large (peut-être pas exactement 790000 ou autre raison)
  console.log('\nPas de match exact 790000$ entre 09h et 14h. Liste des additions LTD :');
  for (const d of snap.docs) {
    const b = d.data();
    if (b.type !== 'add' || b.iban !== 'LTDSANDY') continue;
    console.log(`  ${d.id}  ${b.timestamp?.toDate?.()?.toLocaleString('fr-FR')}  +${b.montant}$  "${b.raison}"`);
  }
  process.exit(1);
}

console.log(`\n📍 Transaction trouvée :`);
console.log(`   docId      : ${trouve.id}`);
console.log(`   Date       : ${trouve.timestamp?.toDate?.()?.toLocaleString('fr-FR')}`);
console.log(`   Montant    : +${trouve.montant}$`);
console.log(`   Raison     : "${trouve.raison}"`);
console.log(`   accountId  : ${trouve.accountId}`);
console.log(`   solde après: ${trouve.soldeApres}$`);

console.log('\n✏ Marquage comme subvention...');
await trouve.ref.set({
  categorieEntree: 'subvention',
  subventionRemboursable: true,
  raisonClassification: 'Subvention gouvernementale (Art. 4-2.16 TTE) — non imposable, remboursable via contrat. Sert au bon fonctionnement de la reprise (achat véhicules, matières premières).',
  marqueParUid: 'patron',
  dateMarquage: new Date().toISOString()
}, { merge: true });

console.log('✓ Marquée. Elle apparaîtra désormais dans la section "Subventions" du Dashboard.');
process.exit(0);
