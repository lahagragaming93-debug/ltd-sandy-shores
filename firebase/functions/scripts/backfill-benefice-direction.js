// Backfill : calcule le bénéfice auto pour les ventes existantes de la direction
// (patron Blake, co-patron, admin-technique, drh). Évite les double-calculs si
// benefice déjà présent (déclaration manuelle existante).
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');
const sinceIdx = process.argv.indexOf('--since');
const SINCE = sinceIdx > 0 ? new Date(process.argv[sinceIdx + 1]) : new Date('2026-05-09');

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

console.log(`Mode : ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Depuis : ${SINCE.toISOString().slice(0, 10)}\n`);

// 1. Récupère les uids direction + responsable-vente
const usersSnap = await db.collection('users').get();
const directionUids = new Set();
const userNames = {};
const userRoles = {};
for (const u of usersSnap.docs) {
  const d = u.data();
  userNames[u.id] = `${d.prenom || ''} ${d.nom || ''}`.trim();
  userRoles[u.id] = d.role || '';
  if (['patron', 'co-patron', 'admin-technique', 'drh', 'responsable-vente'].includes(d.role)) {
    directionUids.add(u.id);
  }
}
console.log(`Direction + RV : ${[...directionUids].map(u => userNames[u] + ' (' + userRoles[u] + ')').join(', ')}\n`);

// Cache produits + helper findProduit (lookup par id puis par nom)
const prodsSnap = await db.collection('produits').get();
const prodsList = prodsSnap.docs.map(p => ({ id: p.id, ...p.data() }));
const prodById = {};
for (const p of prodsList) prodById[p.id] = p;

function findProduit(it) {
  const pid = String(it.id || it.produitId || '').trim();
  if (pid && prodById[pid]) return prodById[pid];
  const nom = String(it.nom || '').toLowerCase().trim();
  if (!nom) return null;
  // Alias explicites
  for (const p of prodsList) {
    if (Array.isArray(p.aliases) && p.aliases.some(a => String(a).toLowerCase().trim() === nom)) return p;
  }
  for (const p of prodsList) if ((p.nom || '').toLowerCase().trim() === nom) return p;
  for (const p of prodsList) {
    const pNom = (p.nom || '').toLowerCase().trim();
    if (!pNom) continue;
    if (pNom.includes(nom) || nom.includes(pNom)) return p;
  }
  return null;
}

// Helper : parse items depuis la raison (2 patterns)
function parseItemsDepuisRaison(raison) {
  if (!raison) return [];
  const out = [];
  const re1 = /(\d+)\s*[xX×]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\- ]+?)(?=,|;|$|\s+\d+\s*[xX×])/gi;
  let m;
  while ((m = re1.exec(raison))) {
    out.push({ quantite: parseInt(m[1], 10), nom: m[2].trim() });
  }
  if (out.length > 0) return out;
  const re2 = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\- ]*?)\s*[xX×]\s*(\d+)/g;
  while ((m = re2.exec(raison))) {
    const nom = m[1].trim();
    const qte = parseInt(m[2], 10);
    if (nom && qte > 0) out.push({ quantite: qte, nom });
  }
  return out;
}

// 2. Récupère les ventes direction depuis SINCE
const ventesSnap = await db.collection('ventes')
  .where('timestamp', '>=', Timestamp.fromDate(SINCE))
  .orderBy('timestamp', 'desc')
  .get();

let candidates = 0, enrichies = 0, skipDejaCalcul = 0, skipNoItems = 0, skipManquantPrix = 0;

for (const d of ventesSnap.docs) {
  const v = d.data();
  if (!directionUids.has(v.vendeurId)) continue;
  candidates++;

  // Skip si bénéfice déjà calculé manuellement (déclaration site)
  if (v.benefice != null && v.benefice > 0 && v.beneficeSource !== 'auto-direction') {
    skipDejaCalcul++;
    continue;
  }
  // Re-parse items depuis la raison si l'array stocké est vide (cas direction)
  let items = Array.isArray(v.items) && v.items.length > 0
    ? v.items
    : parseItemsDepuisRaison(v.raison || '');

  if (items.length === 0) {
    skipNoItems++;
    continue;
  }

  let coutTotal = 0;
  let allResolus = true;
  for (const it of items) {
    const qte = Number(it.quantite || 0);
    if (qte <= 0) { allResolus = false; continue; }
    const prod = findProduit(it);
    if (!prod) { allResolus = false; continue; }
    coutTotal += qte * (Number(prod.prixAchat) || 0);
  }

  if (!allResolus || coutTotal === 0) {
    skipManquantPrix++;
    continue;
  }

  const benefice = Math.max(0, Number(v.montant || 0) - coutTotal);
  const ts = v.timestamp?.toDate?.()?.toLocaleString('fr-FR') || '?';
  console.log(`  ${ts}  ${userNames[v.vendeurId].padEnd(20)}  ${String(v.montant).padStart(6)}$  −  ${String(coutTotal).padStart(6)}$  =  ${String(benefice).padStart(6)}$  bénéfice`);

  if (APPLY) {
    await d.ref.set({
      benefice,
      beneficeSource: 'auto-direction',
      beneficeRecalculLe: new Date().toISOString()
    }, { merge: true });
    enrichies++;
  }
}

console.log(`\nRésumé :`);
console.log(`  ${candidates} ventes direction trouvées`);
console.log(`  ${enrichies} enrichies avec bénéfice auto`);
console.log(`  ${skipDejaCalcul} skip (bénéfice déjà calculé par déclaration manuelle)`);
console.log(`  ${skipNoItems} skip (pas d'items extractibles)`);
console.log(`  ${skipManquantPrix} skip (prix d'achat manquant ou items non résolus)`);
if (!APPLY) console.log(`\nDry-run. --apply pour écrire.`);
process.exit(0);
