// Remet andrew.beauchamp en admin-technique apres un test de role.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });

const UID = 'dq9luBiCWxdJaPayZMvFQn2IbPf2';
const db = getFirestore();
await db.collection('users').doc(UID).update({ role: 'admin-technique' });
const after = await db.collection('users').doc(UID).get();
console.log('OK : role apres update =', after.data().role);
process.exit(0);
