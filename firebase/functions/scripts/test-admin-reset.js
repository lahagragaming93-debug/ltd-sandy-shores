// Test direct de la cloud function adminResetPassword
// Signe in en tant qu'un patron, recupere un idToken, puis POST sur la fonction.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });

// Genere un custom token pour Andrew (patron), echange contre un ID token via REST,
// puis appelle la fonction.
const callerUid = process.argv[2] || 'dq9luBiCWxdJaPayZMvFQn2IbPf2'; // Andrew par defaut
const targetUid = process.argv[3] || callerUid;

const customToken = await getAdminAuth().createCustomToken(callerUid);
console.log('Custom token cree pour caller', callerUid);

// Echange custom token -> id token via REST
const apiKey = 'AIzaSyA2A_zJZ8NeZO8Hbvp4TBJSFlhKxy7fgxI'; // public web API key
const exchangeResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: customToken, returnSecureToken: true })
});
const exchangeJson = await exchangeResp.json();
if (!exchangeJson.idToken) {
  console.error('Echange echoue:', exchangeJson);
  process.exit(1);
}
console.log('ID token obtenu (longueur)', exchangeJson.idToken.length);

// Appel la fonction
const resp = await fetch('https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/adminResetPassword', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + exchangeJson.idToken },
  body: JSON.stringify({ targetUid })
});
console.log('Status HTTP:', resp.status, resp.statusText);
const text = await resp.text();
console.log('Body:', text);
process.exit(0);
