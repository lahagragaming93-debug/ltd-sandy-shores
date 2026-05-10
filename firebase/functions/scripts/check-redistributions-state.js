// ============================================================
// Diagnostic /redistributions : compte et liste les docs par
// fivemPompeId, pour detecter d'eventuels stationId errones a
// re-mapper apres correction des mappings pompes.
// ============================================================
// Usage : node scripts/check-redistributions-state.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const cfgSnap = await db.collection('config').doc('global').get();
const mapping = (cfgSnap.exists ? cfgSnap.data() : {}).fivemPompesMap || {};

const redisSnap = await db.collection('redistributions').get();
console.log(`\n${redisSnap.size} docs dans /redistributions\n`);

// Groupe par (fivemPompeId, stationId)
const groupes = new Map();
const sansPompeId = [];
redisSnap.forEach(d => {
  const r = d.data();
  const pid = r.fivemPompeId || r.redistributionId || '';
  if (!pid) { sansPompeId.push({ id: d.id, ...r }); return; }
  const key = `${pid}|${r.stationId || ''}`;
  if (!groupes.has(key)) groupes.set(key, { pid, stationId: r.stationId || '', station: r.station || '', count: 0 });
  groupes.get(key).count++;
});

console.log('Mapping actuel /config.fivemPompesMap :');
Object.entries(mapping).forEach(([k, v]) => console.log(`  ${k.padEnd(8)} → ${v}`));

console.log('\nDocs /redistributions groupes par (pompe, stationId) :');
const sorted = [...groupes.values()].sort((a, b) => a.pid.localeCompare(b.pid));
for (const g of sorted) {
  const attendu = mapping[g.pid] || '(non mappe)';
  const erreur = g.stationId && attendu !== '(non mappe)' && g.stationId !== attendu;
  const marker = erreur ? ' ⚠ INCOHERENT' : '';
  console.log(`  pompe ${g.pid.padEnd(8)} stationId="${g.stationId.padEnd(40)}" (${g.count} docs) — attendu "${attendu}"${marker}`);
}

if (sansPompeId.length > 0) {
  console.log(`\n${sansPompeId.length} docs sans fivemPompeId (anciennes redistributions ou rattrapage revenu).`);
}
