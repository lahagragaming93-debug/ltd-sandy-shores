// Corrige les patterns HDM et Dynasty 8 pour utiliser le nouveau matchType
// account-id-cible (Phase 3) au lieu de compte-cible avec une valeur erronée.
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

// Corrections à appliquer
const CORRECTIONS = {
  'hdm': {
    matchType: 'account-id-cible',
    matchValue: '67978',
    label: 'HDM (Heavy Duty Motors)',
    categorie: 'location-vehicule',
    deductible: true,
    raisonClassification: 'Location véhicule utilitaire HDM (accountId 67978) — Art. 4-2.12'
  },
  'hdm-factures': {
    matchType: 'account-id-cible',
    matchValue: '67978',
    label: 'HDM (Heavy Duty Motors) — par accountId',
    categorie: 'location-vehicule',
    deductible: true,
    raisonClassification: 'Identifiable automatiquement via accountId destinataire (67978)'
  },
  'dynasty-8-factures': {
    matchType: 'facture-id',
    matchValue: '1908905',
    label: 'Dynasty 8 — factures',
    categorie: 'decoration-locaux',
    deductible: false,
    raisonClassification: 'Décoration des locaux entreprise — non déductible TTE Art. 4-2.11. Ajouter ici les futurs N° de facture Dynasty 8 séparés par virgule, OU mieux : remplacer par account-id-cible avec l\'accountId Dynasty 8 si connu.'
  }
};

const cfgRef = db.collection('config').doc('global');
const cfgSnap = await cfgRef.get();
const patterns = cfgSnap.exists ? (cfgSnap.data().fournisseurs || []) : [];

let modifs = 0;
for (const [id, fix] of Object.entries(CORRECTIONS)) {
  const idx = patterns.findIndex(p => p.id === id);
  if (idx < 0) {
    console.log(`  · ${id} : introuvable, skip`);
    continue;
  }
  const ancien = patterns[idx];
  console.log(`  ⟳ ${id}`);
  console.log(`    AVANT  : matchType=${ancien.matchType}, matchValue="${ancien.matchValue}", categorie=${ancien.categorie}`);
  console.log(`    APRÈS  : matchType=${fix.matchType}, matchValue="${fix.matchValue}", categorie=${fix.categorie}`);
  patterns[idx] = { ...ancien, ...fix, dateAjout: new Date().toISOString() };
  modifs++;
}

await cfgRef.set({ fournisseurs: patterns }, { merge: true });
console.log(`\n✓ ${modifs} pattern(s) corrigé(s).`);
process.exit(0);
