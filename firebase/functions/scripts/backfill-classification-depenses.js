// ============================================================
// Backfill : reclassification des dépenses existantes selon mapping fournisseurs
// ============================================================
// Avant 2026-05-14, le handler onDepense classifiait les dépenses uniquement
// par regex sur la raison. Toutes les "Achat boutique N°XXX" et "Paiement
// facture N°XXXXXXX" et "Achat essence" sortaient en non-deductible.
//
// Ce script :
//   1. Lit /config/global.fournisseurs (alimenté par init-fournisseurs-mapping.js)
//   2. Parcourt toutes les /depenses
//   3. Pour chaque dépense non encore validée par patron :
//      - Extrait boutiqueId / factureId depuis la raison
//      - Cherche un pattern qui match → applique la classification suggérée
//      - Met à jour : type, deductible, categorieSuggeree, deductibleSuggere,
//        fournisseurPatternId, fournisseurLabel, raisonClassification
//   4. Liste les dépenses "à classifier manuellement" pour le patron
//
// IDEMPOTENT :
//   - Skip les dépenses avec valideParPatron === true (déjà validées)
//   - Re-applique le mapping sans regret (overwrites les suggestions)
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/backfill-classification-depenses.js                 dry-run
//   node scripts/backfill-classification-depenses.js --apply
//   node scripts/backfill-classification-depenses.js --apply --since 2026-05-01
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');
const sinceIdx = process.argv.indexOf('--since');
// Par défaut, on remonte jusqu'à l'ouverture officielle du LTD par Blake MARS
// (2026-05-09). Ajustable via --since YYYY-MM-DD.
const SINCE = sinceIdx > 0 ? new Date(process.argv[sinceIdx + 1]) : new Date('2026-05-09');

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

function matchesFournisseurPattern(pat, dep, raison) {
  if (!pat || !pat.matchType || !pat.matchValue) return false;
  // Extraction "live" de boutiqueId / factureId si pas déjà sur le doc
  const boutiqueMatch = raison.match(/Achat\s+boutique\s*N[°º]?\s*(\d+)/i);
  const boutiqueId = dep.boutiqueId || (boutiqueMatch ? boutiqueMatch[1] : null);
  const factureMatch = raison.match(/Paiement\s+facture\s*N[°º]?\s*(\d+)/i);
  const factureId = dep.factureId || (factureMatch ? factureMatch[1] : null);

  // Support multi-valeurs : matchValue séparé par virgule (sauf raison-regex)
  const valeurs = String(pat.matchValue).split(',').map(v => v.trim()).filter(Boolean);

  switch (pat.matchType) {
    case 'boutique-id':
      return !!boutiqueId && valeurs.includes(String(boutiqueId));
    case 'facture-id':
      return !!factureId && valeurs.includes(String(factureId));
    case 'raison-regex':
      try {
        return new RegExp(pat.matchValue, 'i').test(raison || '');
      } catch (e) {
        return false;
      }
    case 'compte-cible':
      if (!dep.compteCibleNom) return false;
      const compte = String(dep.compteCibleNom).toLowerCase();
      return valeurs.some(v => compte.includes(v.toLowerCase()));
    case 'account-id-cible':
      if (!dep.compteCibleAccountId) return false;
      return valeurs.includes(String(dep.compteCibleAccountId));
    default:
      return false;
  }
}

// Cross-réf historique : pour une dépense passée, retrouve le removemoney
// correspondant dans /banqueLtd (même montant, timestamp à ±90s, toPropername
// présent). Renvoie le doc banque ou null.
async function lookupCompteCibleHistorique(db, dep, Timestamp) {
  const ts = dep.timestamp?.toDate?.();
  if (!ts) return null;
  const since = new Date(ts.getTime() - 90 * 1000);
  const until = new Date(ts.getTime() + 90 * 1000);
  try {
    const snap = await db.collection('banqueLtd')
      .where('timestamp', '>=', Timestamp.fromDate(since))
      .where('timestamp', '<=', Timestamp.fromDate(until))
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    for (const d of snap.docs) {
      const b = d.data();
      if (b.type !== 'remove') continue;
      if (Number(b.montant) !== Number(dep.montant)) continue;
      if (b.iban && b.iban !== 'LTDSANDY') continue;
      if (!b.toPropername && !b.toName) continue;
      return b;
    }
  } catch (e) {
    return null;
  }
  return null;
}

async function main() {
  console.log(`Mode : ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Backfill depuis : ${SINCE.toISOString()}\n`);

  const cfgSnap = await db.collection('config').doc('global').get();
  const patterns = cfgSnap.exists ? (cfgSnap.data().fournisseurs || []) : [];
  console.log(`${patterns.length} patterns fournisseurs en config\n`);

  const depSnap = await db.collection('depenses')
    .where('timestamp', '>=', Timestamp.fromDate(SINCE))
    .orderBy('timestamp', 'desc')
    .get();

  console.log(`${depSnap.size} dépenses dans la plage\n`);

  let reclassified = 0, skippedValidated = 0, aClassifier = 0, unchanged = 0, enrichisCompteCible = 0;
  const aClassifierList = [];

  for (const d of depSnap.docs) {
    const dep = d.data();

    // Skip si patron a déjà validé
    if (dep.valideParPatron === true) {
      skippedValidated++;
      continue;
    }
    // Skip les paies (déjà traitées via détection paie/salaire)
    if (dep.type === 'paie') {
      unchanged++;
      continue;
    }

    const raison = String(dep.raison || '');
    // Re-extraire boutiqueId / factureId si pas sur le doc
    const boutiqueMatch = raison.match(/Achat\s+boutique\s*N[°º]?\s*(\d+)/i);
    const boutiqueId = dep.boutiqueId || (boutiqueMatch ? boutiqueMatch[1] : null);
    const factureMatch = raison.match(/Paiement\s+facture\s*N[°º]?\s*(\d+)/i);
    const factureId = dep.factureId || (factureMatch ? factureMatch[1] : null);

    // Phase 2 — cross-réf historique compte cible
    let compteCibleNom = dep.compteCibleNom || '';
    let compteCibleAccountId = dep.compteCibleAccountId || '';
    let compteCibleDiscord = dep.compteCibleDiscord || '';
    if (!compteCibleNom) {
      const banque = await lookupCompteCibleHistorique(db, dep, Timestamp);
      if (banque) {
        compteCibleNom = banque.toPropername || banque.toName || '';
        compteCibleAccountId = banque.accountId || '';
        compteCibleDiscord = banque.toDiscord || '';
        enrichisCompteCible++;
      }
    }

    let fournisseur = null;
    for (const pat of patterns) {
      if (matchesFournisseurPattern(pat, { boutiqueId, factureId, compteCibleNom, ...dep }, raison)) {
        fournisseur = pat;
        break;
      }
    }

    if (fournisseur) {
      const ts = dep.timestamp?.toDate?.()?.toLocaleString('fr-FR') || '?';
      console.log(`  ${ts.padEnd(20)}  ${raison.padEnd(45).slice(0, 45)}  ${String(dep.montant || 0).padStart(8)}$  →  ${fournisseur.label.padEnd(22)}  ${fournisseur.deductible ? '✓ dédu' : '✗ non-dédu'}${compteCibleNom ? `  [cible: ${compteCibleNom}]` : ''}`);
      if (APPLY) {
        await d.ref.set({
          type: fournisseur.categorie,
          deductible: !!fournisseur.deductible,
          categorieSuggeree: fournisseur.categorie,
          deductibleSuggere: !!fournisseur.deductible,
          fournisseurPatternId: fournisseur.id,
          fournisseurLabel: fournisseur.label,
          raisonClassification: fournisseur.raisonClassification || '',
          boutiqueId: boutiqueId || null,
          factureId: factureId || null,
          compteCibleNom: compteCibleNom || null,
          compteCibleAccountId: compteCibleAccountId || null,
          compteCibleDiscord: compteCibleDiscord || null,
          // valideParPatron reste false : patron doit toujours valider explicitement
        }, { merge: true });
      }
      reclassified++;
    } else {
      // Même sans match, on persiste le compte cible identifié (pour aide patron)
      if (APPLY && compteCibleNom && !dep.compteCibleNom) {
        await d.ref.set({
          compteCibleNom,
          compteCibleAccountId: compteCibleAccountId || null,
          compteCibleDiscord: compteCibleDiscord || null,
          boutiqueId: boutiqueId || null,
          factureId: factureId || null
        }, { merge: true });
      }
      aClassifier++;
      aClassifierList.push({
        id: d.id,
        ts: dep.timestamp?.toDate?.()?.toLocaleString('fr-FR') || '?',
        raison,
        montant: dep.montant || 0,
        utilisateur: dep.utilisateur || '',
        compteCibleNom: compteCibleNom || '—'
      });
    }
  }

  console.log(`\nRésumé :`);
  console.log(`  ${reclassified} dépenses reclassées via mapping fournisseur`);
  console.log(`  ${enrichisCompteCible} dépenses enrichies avec compte cible (cross-réf /banqueLtd)`);
  console.log(`  ${skippedValidated} skippées (déjà validées par patron)`);
  console.log(`  ${unchanged} type='paie' (inchangées)`);
  console.log(`  ${aClassifier} dépenses à classifier manuellement (pas de pattern)\n`);

  if (aClassifierList.length > 0 && aClassifierList.length <= 50) {
    console.log(`Liste "à classifier manuellement" (à valider par patron dans la page Compta) :`);
    for (const a of aClassifierList) {
      console.log(`  ${a.ts.padEnd(20)}  ${a.raison.padEnd(40).slice(0, 40)}  ${String(a.montant).padStart(8)}$  cible: ${a.compteCibleNom.padEnd(20).slice(0, 20)} (${a.utilisateur})`);
    }
  } else if (aClassifierList.length > 50) {
    console.log(`(${aClassifierList.length} entrées — trop pour afficher en console, voir page Compta)`);
  }

  if (!APPLY && reclassified > 0) {
    console.log(`\nDry-run terminé. Relance avec --apply pour écrire.`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
