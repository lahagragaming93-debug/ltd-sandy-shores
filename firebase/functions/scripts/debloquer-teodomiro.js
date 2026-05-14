// Débloque Teodomiro : décache les factures bot #1915402 et #1915409
// qui ont été faussement marquées "cachée" par le dédup automatique.
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

const FACTURES_A_DEBLOQUER = ['1915402', '1915409'];

for (const billId of FACTURES_A_DEBLOQUER) {
  const ref = db.collection('ventes').doc(`fac-${billId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`❌ fac-${billId} introuvable`);
    continue;
  }
  const v = snap.data();
  console.log(`\n📍 fac-${billId} :`);
  console.log(`   timestamp : ${v.timestamp?.toDate?.()?.toLocaleString('fr-FR')}`);
  console.log(`   vendeur   : ${v.vendeurNom}`);
  console.log(`   montant   : ${v.montant}$`);
  console.log(`   cachee    : ${!!v.cachee}`);
  console.log(`   liee à    : ${v.remplaceeParId || '—'}`);

  if (!v.cachee && !v.annulee) {
    console.log('   → déjà visible, skip');
    continue;
  }

  await ref.set({
    cachee: false,
    remplaceeParId: FieldValue.delete(),
    remplaceeParFactureId: FieldValue.delete(),
    dateCachage: FieldValue.delete(),
    debloqueePar: 'fix-bug-dedup',
    dateDeblocage: FieldValue.serverTimestamp()
  }, { merge: true });
  console.log('   ✓ décachée — Teodomiro pourra maintenant la déclarer');
}

console.log('\n✓ Terminé. Teodomiro doit F5 sa page Mon Espace.');
process.exit(0);
