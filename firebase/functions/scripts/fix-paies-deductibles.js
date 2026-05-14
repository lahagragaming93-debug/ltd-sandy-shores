// Force deductible=true sur toutes les dépenses type='paie'
// (Art. 4-2.5/4-2.6/4-2.7 — salaires et primes sont déductibles)
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

const snap = await db.collection('depenses').where('type', '==', 'paie').get();
console.log(`${snap.size} dépenses type='paie' trouvées`);

let updated = 0;
for (const d of snap.docs) {
  const data = d.data();
  if (data.deductible === true) continue;
  await d.ref.set({
    deductible: true,
    raisonClassification: 'Salaire/paie (Art. 4-2.5) — déductible TTE'
  }, { merge: true });
  updated++;
}
console.log(`✓ ${updated} dépense(s) corrigée(s) en déductible=true`);
process.exit(0);
