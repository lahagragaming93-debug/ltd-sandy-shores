import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const SINCE = new Date('2026-05-10T00:00:00Z');

console.log('--- /depenses depuis 2026-05-10 ---');
const dSnap = await db.collection('depenses').where('timestamp', '>=', Timestamp.fromDate(SINCE)).get();
console.log(`${dSnap.size} entries`);
dSnap.forEach(d => {
  const x = d.data();
  console.log(`  ${x.timestamp?.toDate?.()?.toISOString()} ${String(x.montant).padStart(7)}$ type=${(x.type||'').padEnd(10)} ded=${x.deductible} raison="${(x.raison||'').slice(0,60)}"`);
});

console.log('\n--- /paies depuis 2026-05-10 ---');
const pSnap = await db.collection('paies').where('timestamp', '>=', Timestamp.fromDate(SINCE)).get();
console.log(`${pSnap.size} entries`);
pSnap.forEach(d => {
  const p = d.data();
  console.log(`  ${p.timestamp?.toDate?.()?.toISOString()} ${String(p.montant).padStart(7)}$ payeur=${(p.payeurNom||p.payeurDiscord||'?').slice(0,20).padEnd(20)} benef=${(p.beneficiaireNom||p.beneficiaireDiscord||'?').slice(0,25)}`);
});

process.exit(0);
