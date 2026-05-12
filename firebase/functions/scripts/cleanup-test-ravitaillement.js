// Nettoyage one-shot des artefacts du test ravitaillement (2026-05-11)
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });

const db = getFirestore();

// 1. Rollback stock Algonquin : 3407 -> 3332
await db.collection('stations').doc('algonquin-boulevard').set({
  stockActuel: 3332,
  sourceMajAuto: 'modal-manuel-direction'   // override pour ne pas re-trigger alerte pompiste
}, { merge: true });
console.log('✓ Stock Algonquin remis a 3332 L');

// 2. Supprimer quota Cesar S2026-05-11
const qDocId = '2026-05-11_IoyZIsL3lDXAQnz9GXKhFnGE97q1';
await db.collection('quotasPompiste').doc(qDocId).delete();
console.log('✓ Quota Cesar S2026-05-11 supprime');

// 3. Supprimer toutes les redistributions test (source=manuel-pompiste, pompisteId=Cesar)
const redis = await db.collection('redistributions')
  .where('source', '==', 'manuel-pompiste')
  .where('pompisteId', '==', 'IoyZIsL3lDXAQnz9GXKhFnGE97q1')
  .get();
for (const d of redis.docs) await d.ref.delete();
console.log(`✓ ${redis.size} redistribution(s) test supprimee(s)`);

// 4. Supprimer alerte overflow test
const al = await db.collection('alertes').where('type', '==', 'pompiste-overflow-tentative').get();
for (const d of al.docs) await d.ref.delete();
console.log(`✓ ${al.size} alerte(s) overflow test supprimee(s)`);

// 5. Supprimer eventuelle alerte 'station-modif-manuelle' creee par le test
const al2 = await db.collection('alertes').where('type', '==', 'station-modif-manuelle').get();
let n = 0;
for (const d of al2.docs) {
  const a = d.data();
  if (a.metadata?.auteur === 'César DE LA CRUZ' && a.metadata?.source === 'modal-bidons-pompiste') {
    await d.ref.delete(); n++;
  }
}
console.log(`✓ ${n} alerte(s) ravitaillement test Cesar supprimee(s)`);

process.exit(0);
