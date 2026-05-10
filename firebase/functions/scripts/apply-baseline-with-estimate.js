// ============================================================
// Applique baseline stations 2026-05-10 + estime stock actuel
// ============================================================
// Pour les 3 stations actives, le stockActuel est estime via :
//   stock = baseline - (sum_montant_redistributions_post_cutoff / prixLitre)
// Pour les 5 stations inactives, stockActuel = 0.
// Toutes les stations : prix selon baseline + seuilAlerte = 0
// (sur demande du patron : pas de seuil d'alerte pour le moment).
// ============================================================
// Cutoff : 2026-05-10T19:00:00Z (debut de session, quand le patron
// a transmis la liste des stocks in-game initiale).
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');

const CUTOFF = new Date('2026-05-10T19:00:00Z');

// === Baseline 2026-05-10 ===
const STATIONS = [
  { id: 'senora-way-rex-s-diner',                nom: "Senora Way - Rex's Dîner",                  baseline:    0, stockMax: 10000, prixLitre: 5.00, active: false },
  { id: 'route-68-ltd',                          nom: "Route 68 LTD",                              baseline:    0, stockMax:  7500, prixLitre: 5.00, active: false },
  { id: 'route-68',                              nom: "Route 68",                                  baseline:    0, stockMax: 10000, prixLitre: 5.00, active: false },
  { id: 'panorama-drive-aerodrome-sandy-shores', nom: "Panorama Drive - Aérodrome Sandy Shores",   baseline: 2000, stockMax:  5000, prixLitre: 5.00, active: true,  fivemPompeId: '16060' },
  { id: 'palomino-freeway-favelas',              nom: "Palomino Freeway - Favélas",                baseline:    0, stockMax: 15000, prixLitre: 6.00, active: false, fivemPompeId: '16513' },
  { id: 'clinton-avenue-vinewood',               nom: "Clinton Avenue - Vinewood",                 baseline:    0, stockMax: 15000, prixLitre: 5.50, active: false },
  { id: 'algonquin-boulevard',                   nom: "Algonquin Boulevard",                       baseline: 3367, stockMax:  5000, prixLitre: 4.50, active: true,  fivemPompeId: '16426' },
  { id: 'cholla-springs-avenue',                 nom: "Cholla Springs Avenue",                     baseline: 4506, stockMax:  5000, prixLitre: 4.50, active: true,  fivemPompeId: '35489' }
];

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

console.log('='.repeat(60));
console.log(`Apply baseline + estimate stock — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log('='.repeat(60));
console.log(`Cutoff redistributions : ${CUTOFF.toISOString()}\n`);

// Charge toutes les redistributions post-cutoff en 1 seul scan
const cutoffTs = Timestamp.fromDate(CUTOFF);
const redisSnap = await db.collection('redistributions')
  .where('timestamp', '>=', cutoffTs)
  .get();
console.log(`${redisSnap.size} redistributions post-cutoff a analyser.\n`);

// Aggrege par stationId
const ventesParStation = new Map();
redisSnap.forEach(d => {
  const r = d.data();
  const sid = r.stationId || '';
  if (!sid) return;
  const m = Number(r.montant) || 0;
  ventesParStation.set(sid, (ventesParStation.get(sid) || 0) + m);
});

console.log('Ventes post-baseline par station :');
[...ventesParStation.entries()].sort().forEach(([sid, total]) => {
  console.log(`  ${sid.padEnd(40)} ${total.toFixed(2).padStart(10)} $`);
});

console.log('\nCalcul stockActuel estime :');
for (const s of STATIONS) {
  const sumMontant = ventesParStation.get(s.id) || 0;
  if (s.active) {
    const litresVendus = sumMontant / s.prixLitre;
    s.stockEstime = Math.max(0, Math.round(s.baseline - litresVendus));
    console.log(`  ${s.id.padEnd(40)} baseline=${String(s.baseline).padStart(5)} L  - ${sumMontant.toFixed(2).padStart(8)}$/${s.prixLitre}$ = ${litresVendus.toFixed(1).padStart(7)} L vendus → ${String(s.stockEstime).padStart(5)} L`);
  } else {
    s.stockEstime = 0;
    if (sumMontant > 0) {
      console.log(`  ${s.id.padEnd(40)} inactive mais ${sumMontant.toFixed(2)}$ vendus post-cutoff → quand meme set a 0`);
    }
  }
}

if (!APPLY) {
  console.log('\nDry-run. Relance avec --apply pour ecrire.');
  process.exit(0);
}

console.log('\n--- WRITE FIRESTORE ---');
for (const s of STATIONS) {
  const patch = {
    nom: s.nom,
    stockActuel: s.stockEstime,
    stockMax: s.stockMax,
    prixLitre: s.prixLitre,
    seuilAlerte: 0
  };
  if (s.fivemPompeId) patch.fivemPompeId = s.fivemPompeId;
  await db.collection('stations').doc(s.id).set(patch, { merge: true });
  console.log(`  ✓ ${s.id.padEnd(40)} stock=${s.stockEstime} prix=${s.prixLitre} seuil=0`);
}

console.log('\nDone.');
process.exit(0);
