// MAJ du pattern Yootool pour inclure plusieurs N° de comptoirs
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

// Yootool a plusieurs comptoirs de vente in-game. Ajouter ici tous les N° connus.
const COMPTOIRS_YOOTOOL = '263,264,266';

const cfgRef = db.collection('config').doc('global');
const cfgSnap = await cfgRef.get();
const patterns = cfgSnap.exists ? (cfgSnap.data().fournisseurs || []) : [];

const idx = patterns.findIndex(p => p.id === 'yootool');
if (idx < 0) {
  console.log('Pattern "yootool" introuvable — annulé');
  process.exit(1);
}

const ancien = patterns[idx];
console.log(`Ancien matchValue : "${ancien.matchValue}"`);
console.log(`Nouveau matchValue : "${COMPTOIRS_YOOTOOL}"`);

patterns[idx] = { ...ancien, matchValue: COMPTOIRS_YOOTOOL, dateAjout: new Date().toISOString() };

await cfgRef.set({ fournisseurs: patterns }, { merge: true });
console.log('\n✓ Pattern Yootool mis à jour avec multi-comptoirs');
process.exit(0);
