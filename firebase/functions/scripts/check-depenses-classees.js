// ============================================================
// Diagnostic : vérifie l'état des dépenses reclassées par le patron
// ============================================================
// Liste les 20 dernières dépenses avec leur statut de classification :
//   - deductible (true/false)
//   - type (catégorie)
//   - fournisseurLabel
//   - valideParPatron (true = patron a validé)
//   - validateurNom / dateValidation
// ============================================================
// Usage : node scripts/check-depenses-classees.js

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

const snap = await db.collection('depenses')
  .orderBy('timestamp', 'desc')
  .limit(20)
  .get();

console.log(`${snap.size} dépenses (20 plus récentes) :\n`);
console.log('Date              | Raison                              | Montant | Type                    | Dédu | Validé | Fournisseur');
console.log('------------------+-------------------------------------+---------+-------------------------+------+--------+------------------------');

for (const d of snap.docs) {
  const x = d.data();
  const date = x.timestamp?.toDate?.()?.toLocaleString('fr-FR') || '?';
  const raison = (x.raison || '').slice(0, 35).padEnd(35);
  const montant = String(x.montant || 0).padStart(6) + '$';
  const type = (x.type || '').padEnd(23).slice(0, 23);
  const dedu = x.deductible !== false ? '✓ oui' : '✗ non ';
  const valide = x.valideParPatron ? '🔒 oui' : '— non ';
  const fournisseur = (x.fournisseurLabel || '—').padEnd(22).slice(0, 22);
  console.log(`${date.padEnd(18)} | ${raison} | ${montant} | ${type} | ${dedu} | ${valide} | ${fournisseur}`);
}

process.exit(0);
