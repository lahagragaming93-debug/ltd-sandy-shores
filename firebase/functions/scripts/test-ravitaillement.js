// Test fonctionnel pompisteRavitaillerManuel
// Usage : node scripts/test-ravitaillement.js <stationId> <bidons>
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });

const stationId = process.argv[2];
const bidons = parseInt(process.argv[3] || '5', 10);
if (!stationId) {
  console.error('Usage: node scripts/test-ravitaillement.js <stationId> <bidons>');
  process.exit(1);
}

// César DE LA CRUZ — pompiste-novice
const CALLER_UID = 'IoyZIsL3lDXAQnz9GXKhFnGE97q1';

const customToken = await getAdminAuth().createCustomToken(CALLER_UID);
const apiKey = 'AIzaSyA2A_zJZ8NeZO8Hbvp4TBJSFlhKxy7fgxI';
const exchangeResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: customToken, returnSecureToken: true })
});
const ex = await exchangeResp.json();
if (!ex.idToken) { console.error('Echange echoue', ex); process.exit(1); }

console.log(`\n=== Test ravitaillement : ${bidons} bidons sur station ${stationId} ===`);

// Etat AVANT
const db = getFirestore();
const stBefore = await db.collection('stations').doc(stationId).get();
console.log('Stock AVANT :', stBefore.data()?.stockActuel, '/', stBefore.data()?.stockMax, 'L');

const resp = await fetch('https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/pompisteRavitaillerManuel', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ex.idToken },
  body: JSON.stringify({ stationId, bidons })
});
const body = await resp.json().catch(() => ({}));
console.log('HTTP', resp.status, JSON.stringify(body));

// Etat APRES
const stAfter = await db.collection('stations').doc(stationId).get();
console.log('Stock APRES :', stAfter.data()?.stockActuel, '/', stAfter.data()?.stockMax, 'L');

// Quota
const today = new Date(); today.setHours(0,0,0,0);
const day = today.getDay(); today.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
const wId = today.toISOString().slice(0, 10);
const qDoc = await db.collection('quotasPompiste').doc(`${wId}_${CALLER_UID}`).get();
console.log(`Quota Cesar S${wId} :`, qDoc.exists ? qDoc.data() : '(aucun)');

process.exit(0);
