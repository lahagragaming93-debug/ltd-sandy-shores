// Diagnostic complet compta semaine en cours :
//  - /ventes : visibles vs cachees, total CA
//  - /redistributions : total CA carburant
//  - /depenses : total + classees vs non-classees
//  - /paies : total verse
//
// Usage : node scripts/diag-compta-semaine.js [YYYY-MM-DD]  (defaut = lundi de la semaine courante Paris)

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

function lundiCourant(refDateStr) {
  const d = refDateStr ? new Date(refDateStr + 'T00:00:00+02:00') : new Date();
  // jour 1 = lundi (Europe/Paris simplifie)
  const dow = (d.getDay() + 6) % 7; // 0=lundi
  const lundi = new Date(d);
  lundi.setHours(0, 0, 0, 0);
  lundi.setDate(lundi.getDate() - dow);
  return lundi;
}

const debut = lundiCourant(process.argv[2]);
const fin = new Date(debut);
fin.setDate(fin.getDate() + 7);
fin.setMilliseconds(-1);

console.log('Periode :', debut.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }), '->', fin.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }));
console.log('UTC range:', debut.toISOString(), '->', fin.toISOString());
console.log('');

const [ventesSnap, redistSnap, depSnap, paiesSnap] = await Promise.all([
  db.collection('ventes')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
  db.collection('redistributions')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
  db.collection('depenses')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
  db.collection('paies')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
]);

// === VENTES ===
let caVisible = 0, caCachee = 0, caTotal = 0;
let nVisibles = 0, nCachees = 0;
const cacheesDetail = [];
const visiblesDetail = [];
for (const d of ventesSnap.docs) {
  const v = d.data();
  const montant = Number(v.montant || 0);
  caTotal += montant;
  if (v.cachee) {
    nCachees++;
    caCachee += montant;
    cacheesDetail.push({ id: d.id, factureId: v.factureId, montant, vendeur: v.vendeurNom, source: v.source, motif: v.motifAnnulation || (v.remplaceeParFactureId ? `dedup->${v.remplaceeParFactureId}` : 'cachee'), annulee: v.annulee });
  } else {
    nVisibles++;
    caVisible += montant;
    visiblesDetail.push({ id: d.id, factureId: v.factureId, montant, vendeur: v.vendeurNom, source: v.source, ts: v.timestamp?.toDate?.() });
  }
}

console.log('=== VENTES /ventes ===');
console.log(`  Total brut : ${ventesSnap.size} docs, ${caTotal} $`);
console.log(`  Visibles   : ${nVisibles} docs, ${caVisible} $`);
console.log(`  Cachees    : ${nCachees} docs, ${caCachee} $`);
console.log('');

if (nCachees > 0) {
  console.log('  Detail cachees :');
  cacheesDetail.slice(0, 20).forEach(c => {
    console.log(`    #${c.factureId || c.id}  ${String(c.montant).padStart(6)} $  vendeur=${c.vendeur || '?'}  src=${c.source || '?'}  motif=${c.motif}${c.annulee ? ' [ANNULEE]' : ''}`);
  });
  if (cacheesDetail.length > 20) console.log(`    ... + ${cacheesDetail.length - 20} autres`);
  console.log('');
}

console.log('  Detail visibles (premieres 30) :');
visiblesDetail.sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(0, 30).forEach(v => {
  const dateStr = v.ts ? v.ts.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '?';
  console.log(`    ${dateStr.padEnd(19)}  #${String(v.factureId || v.id).padEnd(10)}  ${String(v.montant).padStart(6)} $  ${v.vendeur || '?'}  (${v.source})`);
});
if (visiblesDetail.length > 30) console.log(`    ... + ${visiblesDetail.length - 30} autres`);
console.log('');

// === REDISTRIBUTIONS (CARBURANT) ===
let caCarbu = 0;
const byStation = {};
for (const d of redistSnap.docs) {
  const r = d.data();
  const m = Number(r.montant || 0);
  caCarbu += m;
  const k = r.stationNom || r.stationId || '?';
  byStation[k] = (byStation[k] || 0) + m;
}
console.log('=== REDISTRIBUTIONS (carburant) /redistributions ===');
console.log(`  Total : ${redistSnap.size} ventes, ${caCarbu} $`);
Object.entries(byStation).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`    ${k.padEnd(30)} ${String(v).padStart(8)} $`);
});
console.log('');

// === DEPENSES ===
let totalDep = 0, totalDedu = 0, totalNonDedu = 0, totalAClassifier = 0, totalPaieDoublon = 0;
const dByType = {};
for (const d of depSnap.docs) {
  const x = d.data();
  const m = Number(x.montant || 0);
  totalDep += m;
  if (x.type === 'paie') { totalPaieDoublon += m; continue; }
  if (x.deductible === false) totalNonDedu += m;
  else totalDedu += m;
  if (x.type === 'a-classifier' || (!x.fournisseurLabel && !x.valideParPatron)) totalAClassifier += m;
  dByType[x.type || '?'] = (dByType[x.type || '?'] || 0) + m;
}
console.log('=== DEPENSES /depenses ===');
console.log(`  Total brut       : ${depSnap.size} docs, ${totalDep} $`);
console.log(`  - type='paie'     : ${totalPaieDoublon} $ (exclu de compta, doublon /paies)`);
console.log(`  Deductibles      : ${totalDedu} $`);
console.log(`  Non deductibles  : ${totalNonDedu} $`);
console.log(`  A classifier     : ${totalAClassifier} $`);
console.log('  Par type :');
Object.entries(dByType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`    ${k.padEnd(28)} ${String(v).padStart(8)} $`);
});
console.log('');

// === PAIES ===
let totalPaies = 0;
const paiesByUser = {};
for (const d of paiesSnap.docs) {
  const p = d.data();
  const m = Number(p.montant || 0);
  totalPaies += m;
  const k = p.beneficiaireNom || p.beneficiaireId || '?';
  paiesByUser[k] = (paiesByUser[k] || 0) + m;
}
console.log('=== PAIES /paies ===');
console.log(`  Total : ${paiesSnap.size} paies, ${totalPaies} $`);
Object.entries(paiesByUser).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`    ${k.padEnd(28)} ${String(v).padStart(8)} $`);
});
console.log('');

// === SYNTHESE ===
const caTtl = caVisible + caCarbu;
console.log('=== SYNTHESE compta semaine ===');
console.log(`  CA produits (visible) : ${caVisible} $`);
console.log(`  CA carburant          : ${caCarbu} $`);
console.log(`  CA TOTAL              : ${caTtl} $`);
console.log(`  Charges deductibles   : ${totalDedu} $`);
console.log(`  Salaires verses       : ${totalPaies} $`);
console.log(`  Resultat imposable    : ${caTtl - totalDedu} $`);
console.log(`  Benefice net          : ${caTtl - totalDedu - totalNonDedu - totalPaies} $`);

process.exit(0);
