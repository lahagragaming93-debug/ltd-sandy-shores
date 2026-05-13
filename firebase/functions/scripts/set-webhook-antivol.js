// Enregistre le webhook Discord anti-vol dans /config/global.webhookAntiVol.
// Usage : URL passee en arg 1 OU variable d'env WEBHOOK_URL.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });

const url = process.argv[2] || process.env.WEBHOOK_URL;
if (!url || !/^https:\/\/discord\.com\/api\/webhooks\//.test(url)) {
  console.error('Usage : node set-webhook-antivol.js <discord-webhook-url>');
  process.exit(1);
}

const db = getFirestore();
await db.collection('config').doc('global').set(
  { webhookAntiVol: url },
  { merge: true }
);
console.log('OK : webhookAntiVol enregistre dans /config/global.');
console.log('   URL :', url.slice(0, 60) + '...');
process.exit(0);
