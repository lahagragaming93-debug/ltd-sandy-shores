// ============================================================
// Re-applique le mapping /config.fivemPompesMap sur /redistributions
// ============================================================
// Pour chaque doc avec fivemPompeId (ou redistributionId numerique
// utilise comme N°pompe), verifie que stationId/station sont coherents
// avec le mapping actuel. Corrige sinon.
// ============================================================
// Usage :
//   node scripts/fix-redistributions-stationid.js          → dry-run
//   node scripts/fix-redistributions-stationid.js --apply  → ecrit
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

console.log('='.repeat(60));
console.log(`Fix redistributions stationId — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log('='.repeat(60));

const cfgSnap = await db.collection('config').doc('global').get();
const mapping = (cfgSnap.exists ? cfgSnap.data() : {}).fivemPompesMap || {};

const stationsSnap = await db.collection('stations').get();
const stationsById = {};
stationsSnap.forEach(d => { stationsById[d.id] = d.data(); });

const redisSnap = await db.collection('redistributions').get();
console.log(`\n${redisSnap.size} docs scannes.\n`);

const aCorriger = [];
redisSnap.forEach(d => {
  const r = d.data();
  // fivemPompeId direct, sinon fallback sur redistributionId
  // (ancien parser stockait le N° dans redistributionId)
  const pid = r.fivemPompeId || (r.redistributionId && /^\d+$/.test(String(r.redistributionId)) ? String(r.redistributionId) : null);
  if (!pid) return;
  const cibleStationId = mapping[pid];
  if (!cibleStationId) return; // pompe non mappee, on laisse
  const cibleStationNom = stationsById[cibleStationId]?.nom || cibleStationId;
  if (r.stationId !== cibleStationId || r.station !== cibleStationNom) {
    aCorriger.push({
      id: d.id,
      pid,
      ancienStationId: r.stationId || '',
      ancienStation:   r.station || '',
      nouveauStationId: cibleStationId,
      nouveauStation:   cibleStationNom
    });
  }
});

console.log(`${aCorriger.length} docs a corriger.\n`);

// Groupe pour resume
const resume = new Map();
for (const c of aCorriger) {
  const k = `${c.pid}|${c.ancienStationId} → ${c.nouveauStationId}`;
  resume.set(k, (resume.get(k) || 0) + 1);
}
console.log('Resume :');
[...resume.entries()].sort().forEach(([k, n]) => console.log(`  ${n.toString().padStart(5)} docs : ${k}`));

if (aCorriger.length === 0) {
  console.log('\nRien a faire.');
  process.exit(0);
}

if (!APPLY) {
  console.log('\nDry-run. Relance avec --apply pour ecrire.');
  process.exit(0);
}

// Batch writes (Firestore limit : 500 ops/batch)
let ok = 0, err = 0;
let batch = db.batch();
let inBatch = 0;
for (const c of aCorriger) {
  batch.set(db.collection('redistributions').doc(c.id), {
    fivemPompeId: c.pid,                    // s'assure que le champ est present
    stationId: c.nouveauStationId,
    station: c.nouveauStation
  }, { merge: true });
  inBatch++;
  if (inBatch >= 400) {
    try { await batch.commit(); ok += inBatch; process.stdout.write(`. ${ok}/${aCorriger.length}\n`); }
    catch (e) { err += inBatch; console.error('Batch FAIL:', e.message); }
    batch = db.batch();
    inBatch = 0;
  }
}
if (inBatch > 0) {
  try { await batch.commit(); ok += inBatch; }
  catch (e) { err += inBatch; console.error('Final batch FAIL:', e.message); }
}

console.log(`\nDone : ${ok} corriges, ${err} erreurs.`);
process.exit(err > 0 ? 1 : 0);
