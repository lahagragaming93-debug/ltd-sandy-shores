import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const sa = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const snap = await db.collection('stations').get();
console.log('Etat /stations :\n');
snap.forEach(d => {
  const s = d.data();
  const ts = s.derniereMajAuto?.toDate?.()?.toISOString() || '-';
  console.log(`  ${d.id.padEnd(40)} stock=${String(s.stockActuel).padStart(5)} / max=${String(s.stockMax).padStart(5)}  prix=${s.prixLitre}  seuil=${s.seuilAlerte}  source=${s.sourceMajAuto || '-'}  ts=${ts}`);
});
process.exit(0);
