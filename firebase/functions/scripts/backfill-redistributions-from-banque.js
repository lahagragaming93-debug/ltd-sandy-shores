// ============================================================
// Backfill /redistributions depuis /banqueLtd
// ============================================================
// Contexte : depuis la migration FiveM (~05/2026), les ventes
// carburant n'arrivent plus sur #suivi-achat-essence mais sur
// #logs-ig en tant que xbankaccount avec raison "Redistribution N°XXXXX".
// Le handler onBankAccount cree desormais les redistributions
// auto, mais les ventes anterieures (deja stockees dans /banqueLtd
// mais pas dans /redistributions) doivent etre rattrapees.
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/backfill-redistributions-from-banque.js          → dry-run
//   node scripts/backfill-redistributions-from-banque.js --apply  → ecrit
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');

function loadServiceAccount() {
  try {
    return JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
  } catch (err) {
    console.error(`\nImpossible de lire ${KEY_PATH}`);
    console.error(`Erreur: ${err.message}\n`);
    process.exit(1);
  }
}

async function main() {
  const sa = loadServiceAccount();
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const db = getFirestore();

  console.log('='.repeat(60));
  console.log(`Backfill redistributions — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));

  // Charge la config + stations pour resoudre le mapping
  const cfgSnap = await db.collection('config').doc('global').get();
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const mapping = cfg.fivemPompesMap || {};
  console.log(`Mapping fivemPompesMap : ${Object.keys(mapping).length} entrees`);

  const stationsSnap = await db.collection('stations').get();
  const stationsById = {};
  stationsSnap.forEach(d => { stationsById[d.id] = d.data(); });

  // Scan /banqueLtd pour entrees "Redistribution N°XXX" sur 'add'
  console.log('\nScan /banqueLtd...');
  const banqueSnap = await db.collection('banqueLtd')
    .where('type', '==', 'add')
    .get();
  console.log(`${banqueSnap.size} entrees 'add' en banque.`);

  const REDIS_RE = /Redistribution\s*N[°º]?\s*(\d+)/i;
  const candidates = [];
  banqueSnap.forEach(d => {
    const b = d.data();
    const m = String(b.raison || '').match(REDIS_RE);
    if (m) candidates.push({ id: d.id, banque: b, fivemPompeId: m[1] });
  });
  console.log(`${candidates.length} ventes carburant detectees dans /banqueLtd.`);

  // Charge les /redistributions existantes pour dedupe sur (timestamp + fivemPompeId + montant)
  // Cle de dedupe : fivemPompeId + timestamp_ms (precision seconde)
  // Cle alternative : redistributionId + timestamp_ms (les anciennes redistributions n'ont
  // pas fivemPompeId mais ont redistributionId qui correspond au meme N° de pompe).
  console.log('\nScan /redistributions existantes (dedupe)...');
  const redisSnap = await db.collection('redistributions').get();
  const dejaPresents = new Set();
  redisSnap.forEach(d => {
    const r = d.data();
    const t = r.timestamp?.toDate?.()?.getTime();
    const pid = r.fivemPompeId || r.redistributionId || '';
    if (t && pid) dejaPresents.add(`${pid}_${Math.floor(t / 1000)}`);
  });
  console.log(`${dejaPresents.size} cles dedupe construites.`);

  // Filtre les vraiment nouveaux
  const aCreer = candidates.filter(c => {
    const t = c.banque.timestamp?.toDate?.()?.getTime();
    if (!t) return true; // pas de timestamp = on ajoute par securite
    const cle = `${c.fivemPompeId}_${Math.floor(t / 1000)}`;
    return !dejaPresents.has(cle);
  });
  console.log(`\n${aCreer.length} redistributions a creer (${candidates.length - aCreer.length} doublons skip).`);

  if (aCreer.length === 0) {
    console.log('\nRien a faire. Fin.');
    process.exit(0);
  }

  // Apercu
  console.log('\nApercu (premiers 10) :');
  for (const c of aCreer.slice(0, 10)) {
    const stationId = mapping[c.fivemPompeId] || '';
    const nom = stationId && stationsById[stationId]?.nom
      ? stationsById[stationId].nom
      : `Station #${c.fivemPompeId}`;
    const t = c.banque.timestamp?.toDate?.()?.toISOString() || '-';
    console.log(`  ${t}  pompe ${c.fivemPompeId.padEnd(6)} ${String(c.banque.montant).padStart(6)}$  → ${nom}`);
  }

  if (!APPLY) {
    console.log('\nDry-run. Relance avec --apply pour ecrire.');
    process.exit(0);
  }

  let ok = 0, err = 0;
  for (const c of aCreer) {
    try {
      const stationId = mapping[c.fivemPompeId] || '';
      const nom = stationId && stationsById[stationId]?.nom
        ? stationsById[stationId].nom
        : `Station #${c.fivemPompeId}`;
      await db.collection('redistributions').add({
        redistributionId: c.fivemPompeId,
        fivemPompeId: c.fivemPompeId,
        station: nom,
        stationId: stationId || '',
        montant: Number(c.banque.montant) || 0,
        soldeAvant: Number(c.banque.soldeAvant) || 0,
        soldeApres: Number(c.banque.soldeApres) || 0,
        litres: null,
        prixLitre: null,
        stockAvant: null,
        stockApres: null,
        source: 'backfill-banqueLtd-2026-05-10',
        timestamp: c.banque.timestamp  // conserve le timestamp d'origine
      });
      ok++;
      if (ok % 50 === 0) process.stdout.write(`  ${ok}/${aCreer.length}\n`);
    } catch (e) {
      err++;
      console.error(`\nERR ${c.id}: ${e.message}`);
    }
  }
  console.log(`\nDone: ${ok} crees, ${err} erreurs.`);
  process.exit(err > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
