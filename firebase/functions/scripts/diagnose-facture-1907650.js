import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const FACTURE_N = '1907650';
const SINCE = new Date('2026-05-10T22:00:00Z');

console.log('=== Recherche facture N°' + FACTURE_N + ' ===\n');

// 1) /banqueLtd
console.log('--- /banqueLtd (raison contient "' + FACTURE_N + '") ---');
const bqSnap = await db.collection('banqueLtd')
  .where('timestamp', '>=', Timestamp.fromDate(SINCE))
  .get();
let bqHits = 0;
bqSnap.forEach(d => {
  const r = d.data();
  if (String(r.raison || '').includes(FACTURE_N)) {
    bqHits++;
    console.log(`  ✓ ${r.timestamp?.toDate?.()?.toISOString()} type=${r.type} ${r.montant}$ "${r.raison}"`);
  }
});
if (bqHits === 0) console.log('  (aucun match)');

// 2) /ventes
console.log('\n--- /ventes (factureId contient "' + FACTURE_N + '") ---');
const vSnap = await db.collection('ventes')
  .where('timestamp', '>=', Timestamp.fromDate(SINCE))
  .get();
console.log(`  ${vSnap.size} ventes au total depuis ${SINCE.toISOString()}`);
let vHits = 0;
vSnap.forEach(d => {
  const r = d.data();
  if (String(r.factureId || r.id || '').includes(FACTURE_N)) {
    vHits++;
    console.log(`  ✓ ${r.timestamp?.toDate?.()?.toISOString()} factureId=${r.factureId} ${r.montant}$ vendeur=${r.vendeurNom || r.vendeurId}`);
  }
});
if (vHits === 0) console.log('  (aucune vente matchant 1907650)');

// 3) /logsBruts (RAW_CHANNELS — #factures + #revenu + autres)
console.log('\n--- /logsBruts (contenu contient "' + FACTURE_N + '") ---');
const lbSnap = await db.collection('logsBruts')
  .where('timestamp', '>=', Timestamp.fromDate(SINCE))
  .get();
console.log(`  ${lbSnap.size} logs bruts depuis ${SINCE.toISOString()}`);
let lbHits = 0;
lbSnap.forEach(d => {
  const r = d.data();
  const c = (r.contenu || '') + JSON.stringify(r.embeds || []);
  if (c.includes(FACTURE_N)) {
    lbHits++;
    console.log(`  ✓ canal=${r.canal || r.channel} ts=${r.timestamp?.toDate?.()?.toISOString()}`);
    console.log(`     contenu: ${(r.contenu || '').slice(0, 200)}`);
    if (r.embeds) console.log(`     embeds: ${JSON.stringify(r.embeds).slice(0, 300)}`);
  }
});
if (lbHits === 0) console.log('  (aucun log brut matchant 1907650)');

// 4) Quels canaux ont émis des logs récents ?
console.log('\n--- Activite logsBruts par canal (dernieres 2h) ---');
const byCanal = new Map();
lbSnap.forEach(d => {
  const r = d.data();
  const c = r.canal || r.channel || '?';
  byCanal.set(c, (byCanal.get(c) || 0) + 1);
});
[...byCanal.entries()].sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
  console.log(`  ${c.padEnd(30)} ${n} msgs`);
});

process.exit(0);
