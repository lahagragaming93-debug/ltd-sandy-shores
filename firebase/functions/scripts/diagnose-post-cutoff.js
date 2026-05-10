import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const sa = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const CUTOFF = new Date('2026-05-10T19:00:00Z');
const snap = await db.collection('redistributions')
  .where('timestamp', '>=', Timestamp.fromDate(CUTOFF))
  .get();

console.log(`${snap.size} redistributions post-cutoff:\n`);
const docs = [];
snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
docs.sort((a, b) => (a.timestamp?.toDate?.()?.getTime() || 0) - (b.timestamp?.toDate?.()?.getTime() || 0));
for (const r of docs) {
  const t = r.timestamp?.toDate?.()?.toISOString() || '-';
  console.log(`  ${t}  pompe=${(r.fivemPompeId || r.redistributionId || '?').toString().padEnd(6)} montant=${String(r.montant).padStart(5)}$  station=${r.station || r.stationId || '?'}  source=${r.source || '-'}`);
}
process.exit(0);
