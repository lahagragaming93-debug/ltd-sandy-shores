// Normalise prenom 'ilyes' -> 'Ilyes' (cohérence title case)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });

const uid = 'Jsq1rGrhCJU0aShX6Szwt48Hbsy1'; // Ilyes CHAIFI
await getFirestore().collection('users').doc(uid).set({ prenom: 'Ilyes' }, { merge: true });
console.log('prenom mis a jour : Ilyes');
process.exit(0);
