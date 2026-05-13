// Backfill /ventes : calcule montantParticulier sur les ventes existantes
// Pour chaque vente, lit les items/lignes, resout pourPro depuis /produits,
// et met a jour le doc. Best-effort : si pas d'items, montantParticulier = montant
// (suppose particulier par defaut, c'etait le cas avant le split).
// Usage : node scripts/backfill-montant-particulier.js [--apply]
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY-RUN');

// Cache des produits pour eviter de relire /produits a chaque ligne
const produitsSnap = await db.collection('produits').get();
const produitsMap = {};
produitsSnap.docs.forEach(d => { produitsMap[d.id] = d.data(); });
console.log(`Catalogue : ${produitsSnap.size} produits charges\n`);

// Toutes les ventes des 30 derniers jours
const debut = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const ventesSnap = await db.collection('ventes')
  .where('timestamp', '>=', Timestamp.fromDate(debut))
  .get();
console.log(`Ventes a traiter : ${ventesSnap.size}\n`);

let dejaCorrect = 0;
let aModifier = 0;
let totalCAavant = 0;
let totalCAapres = 0;

for (const d of ventesSnap.docs) {
  const v = d.data();
  const montant = Number(v.montant || 0);
  totalCAavant += montant;

  // Calcul montantParticulier en fonction des items/lignes + pourPro produits
  let montantParticulier = montant; // fallback : tout en particulier
  const lignes = Array.isArray(v.lignes) && v.lignes.length > 0 ? v.lignes : null;
  const items  = !lignes && Array.isArray(v.items) ? v.items : null;

  if (lignes) {
    // Vente manuelle : on a prixVente + pourPro par ligne (mais pourPro peut etre absent)
    let totalVente = 0;
    let totalParticulier = 0;
    for (const l of lignes) {
      const pid = l.produitId;
      const qte = Number(l.quantite || 0);
      const pv  = Number(l.prixVente || produitsMap[pid]?.prixVente || 0);
      const pourPro = l.pourPro !== undefined
        ? !!l.pourPro
        : !!(produitsMap[pid] && produitsMap[pid].pourPro);
      totalVente += pv * qte;
      if (!pourPro) totalParticulier += pv * qte;
    }
    if (totalVente > 0) {
      montantParticulier = Math.round((totalParticulier / totalVente) * montant * 100) / 100;
    }
  } else if (items) {
    // Vente bot : on a quantite par item, pas de prix → pro-rata par quantite
    let totalQte = 0;
    let qteParticulier = 0;
    for (const it of items) {
      const pid = it.id || it.produitId;
      const qte = Number(it.quantite || 0);
      if (!pid || qte <= 0) continue;
      totalQte += qte;
      const pourPro = !!(produitsMap[pid] && produitsMap[pid].pourPro);
      if (!pourPro) qteParticulier += qte;
    }
    if (totalQte > 0) {
      montantParticulier = Math.round((qteParticulier / totalQte) * montant * 100) / 100;
    }
  }

  totalCAapres += montantParticulier;

  // Compare avec valeur actuelle
  const actuel = v.montantParticulier;
  if (Number(actuel) === Number(montantParticulier)) {
    dejaCorrect++;
    continue;
  }
  aModifier++;
  if (APPLY) {
    await d.ref.update({ montantParticulier });
  }
}

console.log(`Resume :`);
console.log(`  Deja correctes : ${dejaCorrect}`);
console.log(`  A modifier     : ${aModifier}`);
console.log(`  CA total (30j) : ${Math.round(totalCAavant)} $`);
console.log(`  CA particulier : ${Math.round(totalCAapres)} $ (${(totalCAavant > 0 ? totalCAapres/totalCAavant*100 : 0).toFixed(1)}%)`);
console.log(`  CA pro         : ${Math.round(totalCAavant - totalCAapres)} $`);
if (!APPLY) console.log(`\nRelance avec --apply pour modifier.`);
process.exit(0);
