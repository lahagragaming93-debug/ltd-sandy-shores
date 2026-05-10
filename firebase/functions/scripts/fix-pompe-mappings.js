// ============================================================
// Fix mapping pompes FiveM ↔ stations
// ============================================================
// Source de verite : valeurs ci-dessous (confirmees par le patron).
// Synchronise les 2 endroits :
//   - /stations/{id}.fivemPompeId
//   - /config.fivemPompesMap[fivemPompeId] = stationId
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/fix-pompe-mappings.js          → dry-run
//   node scripts/fix-pompe-mappings.js --apply  → ecrit
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');

// === Source de verite ===
// Mapping deduit des anciennes /redistributions (parser #suivi-achat-essence
// qui avait nom_station + N° cote a cote dans le titre "Redistribution N°X — Station").
const MAPPINGS = [
  { fivemPompeId: '15877', stationId: 'route-68-ltd' },
  { fivemPompeId: '16060', stationId: 'panorama-drive-aerodrome-sandy-shores' },
  { fivemPompeId: '16426', stationId: 'algonquin-boulevard' },
  { fivemPompeId: '16428', stationId: 'route-68' },
  { fivemPompeId: '16488', stationId: 'clinton-avenue-vinewood' },
  { fivemPompeId: '16513', stationId: 'palomino-freeway-favelas' },
  { fivemPompeId: '16535', stationId: 'cholla-springs-avenue' },        // swap : etait senora
  { fivemPompeId: '35489', stationId: 'senora-way-rex-s-diner' }         // swap : etait cholla
  // 30358 : 4 docs orphelins, station inconnue — laisse non mappe pour l'instant
];

function loadServiceAccount() {
  try {
    return JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
  } catch (err) {
    console.error(`\nImpossible de lire ${KEY_PATH}\nErreur: ${err.message}\n`);
    process.exit(1);
  }
}

async function main() {
  const sa = loadServiceAccount();
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const db = getFirestore();

  console.log('='.repeat(60));
  console.log(`Fix pompe mappings — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));

  // === ETAT AVANT ===
  console.log('\n--- ETAT AVANT ---');
  const cfgSnap = await db.collection('config').doc('global').get();
  const mappingActuel = (cfgSnap.exists ? cfgSnap.data() : {}).fivemPompesMap || {};
  console.log('\n/config.fivemPompesMap :');
  if (Object.keys(mappingActuel).length === 0) console.log('  (vide)');
  else Object.entries(mappingActuel).forEach(([k, v]) => console.log(`  ${k.padEnd(8)} → ${v}`));

  const stationsSnap = await db.collection('stations').get();
  const stationsById = {};
  stationsSnap.forEach(d => { stationsById[d.id] = d.data(); });
  console.log('\n/stations[*].fivemPompeId :');
  Object.entries(stationsById).forEach(([id, s]) => {
    const p = s.fivemPompeId || '(non defini)';
    console.log(`  ${id.padEnd(40)} → ${p}`);
  });

  // === DIFF ===
  console.log('\n--- DIFF A APPLIQUER ---');
  const stationUpdates = [];   // {stationId, fivemPompeId}
  const mapAdditions  = [];    // {fivemPompeId, stationId}
  const mapRemovals   = [];    // [fivemPompeId]  (entrees obsoletes)

  // Pour chaque mapping cible, verifie l'etat actuel
  for (const m of MAPPINGS) {
    const stationCur = stationsById[m.stationId]?.fivemPompeId || '';
    if (stationCur !== m.fivemPompeId) {
      stationUpdates.push(m);
      console.log(`  station ${m.stationId.padEnd(40)} : "${stationCur}" → "${m.fivemPompeId}"`);
    }
    if (mappingActuel[m.fivemPompeId] !== m.stationId) {
      mapAdditions.push(m);
      console.log(`  map[${m.fivemPompeId}] : "${mappingActuel[m.fivemPompeId] || '-'}" → "${m.stationId}"`);
    }
  }

  // Detecte les anciennes entrees dans le map qui ne correspondent plus
  // a aucun mapping cible (ex. 10060 saisi par erreur).
  // On ne supprime PAS une cle qui est aussi en addition (sinon le delete
  // ecrase la nouvelle valeur).
  const idsEnAdditionEarly = new Set(mapAdditions.map(m => m.fivemPompeId));
  for (const id of Object.keys(mappingActuel)) {
    const cibleStation = mappingActuel[id];
    const concerne = MAPPINGS.find(m => m.stationId === cibleStation);
    if (concerne && concerne.fivemPompeId !== id && !idsEnAdditionEarly.has(id)) {
      mapRemovals.push(id);
      console.log(`  map[${id}] OBSOLETE (pointait vers "${cibleStation}", corrige a "${concerne.fivemPompeId}") → SUPPR`);
    }
  }

  // Detecte aussi les stations qui ont un fivemPompeId orphelin
  // (different du target et pointant vers un map a corriger).
  // IMPORTANT : on ne supprime PAS une cle qui est aussi en addition,
  // car l'addition la reecrit avec la bonne valeur (sinon delete ecrase).
  const idsEnAddition = new Set(mapAdditions.map(m => m.fivemPompeId));
  for (const m of MAPPINGS) {
    const s = stationsById[m.stationId];
    if (s?.fivemPompeId && s.fivemPompeId !== m.fivemPompeId) {
      if (mappingActuel[s.fivemPompeId] === m.stationId
          && !mapRemovals.includes(s.fivemPompeId)
          && !idsEnAddition.has(s.fivemPompeId)) {
        mapRemovals.push(s.fivemPompeId);
        console.log(`  map[${s.fivemPompeId}] OBSOLETE (lie a station "${m.stationId}") → SUPPR`);
      }
    }
  }

  if (stationUpdates.length === 0 && mapAdditions.length === 0 && mapRemovals.length === 0) {
    console.log('  (aucun changement requis, tout est deja a jour)');
    process.exit(0);
  }

  if (!APPLY) {
    console.log('\nDry-run termine. Relance avec --apply pour ecrire.');
    process.exit(0);
  }

  // === APPLY ===
  console.log('\n--- WRITE FIRESTORE ---');

  // 1) Stations : set fivemPompeId
  for (const m of stationUpdates) {
    await db.collection('stations').doc(m.stationId).set(
      { fivemPompeId: m.fivemPompeId },
      { merge: true }
    );
    console.log(`  ✓ /stations/${m.stationId}.fivemPompeId = "${m.fivemPompeId}"`);
  }

  // 2) Map : add + remove
  // FieldValue.delete() pour les obsoletes ; valeur explicite pour additions.
  const patch = {};
  for (const m of mapAdditions) {
    patch[`fivemPompesMap.${m.fivemPompeId}`] = m.stationId;
  }
  for (const id of mapRemovals) {
    patch[`fivemPompesMap.${id}`] = FieldValue.delete();
  }
  if (Object.keys(patch).length > 0) {
    // update() respecte les dotted-paths (a la difference de set+merge)
    await db.collection('config').doc('global').update(patch);
    for (const k of Object.keys(patch)) console.log(`  ✓ /config/global ${k}`);
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
