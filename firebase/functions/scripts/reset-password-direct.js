// Reset direct du mot de passe via Admin SDK (bypass la Cloud Function).
// Usage : node scripts/reset-password-direct.js <uid>
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node scripts/reset-password-direct.js <uid>');
  process.exit(1);
}

const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
let newPassword = '';
for (let i = 0; i < 12; i++) newPassword += chars[Math.floor(Math.random() * chars.length)];

await getAuth().updateUser(uid, { password: newPassword });
await getFirestore().collection('users').doc(uid).set({
  motDePasseProvisoire: true,
  mdpRegenereLe: FieldValue.serverTimestamp(),
  mdpRegenerePar: 'script-direct-admin-sdk'
}, { merge: true });

const userSnap = await getFirestore().collection('users').doc(uid).get();
const u = userSnap.data();
console.log('=================================================');
console.log(' MOT DE PASSE REGENERE');
console.log('=================================================');
console.log(` Compte    : ${u.prenom} ${u.nom}`);
console.log(` Username  : ${u.username || '—'}`);
console.log(` Email     : ${u.email || '—'}`);
console.log(` Nouveau MDP : ${newPassword}`);
console.log('=================================================');
console.log(' A la 1re connexion : choix d\'un MDP permanent obligatoire.');
console.log('=================================================');
process.exit(0);
