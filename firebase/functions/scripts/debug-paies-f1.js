// Diagnostic : lecture des paies récentes en Firestore + cross-check avec /depenses
// pour s'assurer qu'aucun doublon ne se glisse entre #paie et #xbankaccount.
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(resolve(__dirname, '../../serviceAccountKey.json')) });
const db = getFirestore();

const paiesSnap = await db.collection('paies').orderBy('timestamp', 'desc').limit(15).get();
console.log(`\n=== 15 dernières paies dans /paies ===`);
console.log('Date              | Payeur                    | Bénéficiaire              | Montant   | Source');
console.log('------------------+---------------------------+---------------------------+-----------+--------');
for (const d of paiesSnap.docs) {
  const x = d.data();
  const date = x.timestamp?.toDate?.()?.toLocaleString('fr-FR') || '?';
  const payeur = (x.payeur || x.payeurNom || '?').slice(0, 25).padEnd(25);
  const benef  = (x.beneficiaire || x.beneficiaireNom || '?').slice(0, 25).padEnd(25);
  const montant = String(x.montant || 0).padStart(7) + ' $';
  const source = x.source || '?';
  console.log(`${date.padEnd(18)} | ${payeur} | ${benef} | ${montant} | ${source}`);
}

// Cross-check : y a-t-il des dépenses type='paie' qui font potentiellement doublon ?
// On filtre côté client pour éviter le besoin d'index composite.
const depRecents = await db.collection('depenses').orderBy('timestamp', 'desc').limit(200).get();
const depPaies = depRecents.docs.map(d => d.data()).filter(x => x.type === 'paie');
console.log(`\n=== Dépenses type='paie' (doivent être filtrées de l'affichage Compta) ===`);
console.log(`${depPaies.length} doc(s) type=paie parmi les 200 dernières dépenses`);
for (const x of depPaies.slice(0, 10)) {
  const date = x.timestamp?.toDate?.()?.toLocaleString('fr-FR') || '?';
  console.log(`  ${date} | ${(x.raison || '').slice(0, 50)} | ${x.montant} $`);
}

// Stat globale
const paiesAllSnap = await db.collection('paies').get();
console.log(`\n=== Stats globales ===`);
console.log(`Total paies en Firestore : ${paiesAllSnap.size}`);

process.exit(0);
