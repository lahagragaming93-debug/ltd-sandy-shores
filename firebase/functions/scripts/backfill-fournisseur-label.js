// ============================================================
// Backfill : re-match les patterns fournisseurs sur toutes les dépenses
// qui n'ont pas fournisseurLabel posé (mais devraient).
// ============================================================
// Utile après ajout/enrichissement d'un pattern : les dépenses passées
// validées par patron mais sans fournisseurLabel sont mises à jour.
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(resolve(__dirname, '../../serviceAccountKey.json')) });
const db = getFirestore();

// Réplication minimale de matchesFournisseurPattern (logique dans index.js)
function normalizeStr(s) { return String(s || '').toLowerCase().trim(); }
function matches(pat, dep) {
  if (!pat?.matchType || !pat?.matchValue) return false;
  const valeurs = String(pat.matchValue).split(',').map(v => v.trim()).filter(Boolean);
  const raison = dep.raison || '';
  switch (pat.matchType) {
    case 'boutique-id': {
      const m = raison.match(/Achat boutique N[°o]?\s*(\d+)/i);
      const bid = m ? m[1] : (dep.boutiqueId || '');
      return bid && valeurs.includes(String(bid));
    }
    case 'facture-id': {
      const m = raison.match(/Paiement facture N[°o]?\s*(\d+)/i);
      const fid = m ? m[1] : (dep.factureId || '');
      return fid && valeurs.includes(String(fid));
    }
    case 'compte-cible':
      return valeurs.some(v => normalizeStr(dep.compteCibleNom).includes(normalizeStr(v)));
    case 'account-id-cible':
      return valeurs.includes(String(dep.compteCibleAccountId || ''));
    case 'raison-regex':
      return valeurs.some(v => { try { return new RegExp(v, 'i').test(raison); } catch { return false; } });
    default:
      return false;
  }
}

const cfg = (await db.collection('config').doc('global').get()).data() || {};
const patterns = cfg.fournisseurs || [];
console.log(`${patterns.length} patterns chargés.`);

const snap = await db.collection('depenses').get();
console.log(`${snap.size} dépenses scannées.\n`);

let posees = 0;
let inchangees = 0;
for (const doc of snap.docs) {
  const d = doc.data();
  if (d.fournisseurLabel) { inchangees++; continue; }
  for (const pat of patterns) {
    if (matches(pat, d)) {
      await doc.ref.set({ fournisseurLabel: pat.label, fournisseurPatternId: pat.id }, { merge: true });
      console.log(`  ✓ ${(d.timestamp?.toDate?.()?.toLocaleString?.('fr-FR') || '?')} | ${(d.raison || '').slice(0, 35).padEnd(35)} → ${pat.label}`);
      posees++;
      break;
    }
  }
}

console.log(`\n✓ Terminé : ${posees} fournisseurs posés, ${inchangees} déjà présents.`);
process.exit(0);
