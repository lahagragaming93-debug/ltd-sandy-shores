// ============================================================
// One-shot : config.quotaCAVendeur = 50 000 (decision patron 2026-05-25)
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/update-quota-ca-vendeur.mjs           → dry-run (affiche valeur actuelle)
//   node scripts/update-quota-ca-vendeur.mjs --apply   → ecrit 50000
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY     = process.argv.includes('--apply');
const NEW_VALUE = 50000;

initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });
const db = getFirestore();

const ref = db.collection('config').doc('global');
const snap = await ref.get();
const cur = snap.exists ? (snap.data().quotaCAVendeur ?? null) : null;

console.log('[update-quota-ca-vendeur] valeur actuelle :', cur);
console.log('[update-quota-ca-vendeur] valeur cible    :', NEW_VALUE);

if (!APPLY) {
  console.log('[update-quota-ca-vendeur] dry-run — ajoute --apply pour ecrire.');
  process.exit(0);
}

await ref.set({ quotaCAVendeur: NEW_VALUE }, { merge: true });
console.log('[update-quota-ca-vendeur] OK ecrit.');
process.exit(0);
