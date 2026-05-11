// Re-tag les depenses dont la raison est une paie/salaire pour exclure du KPI
// Charges. Idempotent : ne touche que celles qui ont type != 'paie'.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const RE = /\b(paye|paie|salaire|r[ée]mun[ée]ration)\b/i;
const snap = await db.collection('depenses').get();
let toFix = [];
snap.forEach(d => {
  const x = d.data();
  if (RE.test(String(x.raison || '')) && x.type !== 'paie') {
    toFix.push({ id: d.id, raison: x.raison, montant: x.montant, ancienType: x.type });
  }
});
console.log(`${toFix.length} depenses a re-tagger en type='paie' :`);
for (const f of toFix) {
  console.log(`  ${f.id}  ${f.montant}$  type=${f.ancienType} -> paie  raison="${f.raison}"`);
  await db.collection('depenses').doc(f.id).set({ type: 'paie' }, { merge: true });
}
console.log(`Done : ${toFix.length} retaggees.`);
process.exit(0);
