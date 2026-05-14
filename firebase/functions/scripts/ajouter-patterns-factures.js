// Ajoute des patterns facture-id pour HDM et Dynasty 8 (mapping par N° facture)
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

// Patterns facture-id complémentaires (le matching compte-cible ne fonctionne
// pas pour les "Paiement facture N°XXX" car l'embed xbankaccount withdraw ne
// porte pas le destinataire — uniquement le caller).
// Ces patterns mémorisent les N° de facture connus pour chaque destinataire.
// Le patron ajoute les nouveaux N° via Admin → Mapping fournisseurs → ✏ HDM
// → champ "Valeur à matcher" : "1915056,1915038,1910769,<nouveau>".
const NOUVEAUX_PATTERNS = [
  {
    id: 'hdm-factures',
    label: 'HDM (Heavy Duty Motors) — factures',
    matchType: 'facture-id',
    matchValue: '1915056,1915038,1910769',  // 3 factures connues à ce jour
    categorie: 'location-vehicule',
    deductible: true,
    raisonClassification: 'Location véhicule utilitaire (HDM) — Art. 4-2.12. AccountId HDM = 67978. Ajouter ici les futurs N° de facture HDM séparés par virgule.',
    ajoutePar: 'init',
    dateAjout: new Date().toISOString()
  },
  {
    id: 'dynasty-8-factures',
    label: 'Dynasty 8 — factures',
    matchType: 'facture-id',
    matchValue: '1908905',  // 1 facture connue à ce jour
    categorie: 'decoration-locaux',
    deductible: false,
    raisonClassification: 'Décoration des locaux entreprise — non déductible TTE Art. 4-2.11. Ajouter ici les futurs N° de facture Dynasty 8 séparés par virgule.',
    ajoutePar: 'init',
    dateAjout: new Date().toISOString()
  }
];

const cfgRef = db.collection('config').doc('global');
const cfgSnap = await cfgRef.get();
const patterns = cfgSnap.exists ? (cfgSnap.data().fournisseurs || []) : [];

let ajouts = 0, modifs = 0;
for (const nouveau of NOUVEAUX_PATTERNS) {
  const idx = patterns.findIndex(p => p.id === nouveau.id);
  if (idx >= 0) {
    patterns[idx] = { ...patterns[idx], ...nouveau };
    modifs++;
    console.log(`  ⟳ ${nouveau.id} → matchValue="${nouveau.matchValue}"`);
  } else {
    patterns.push(nouveau);
    ajouts++;
    console.log(`  + ${nouveau.id} → matchValue="${nouveau.matchValue}"`);
  }
}

await cfgRef.set({ fournisseurs: patterns }, { merge: true });
console.log(`\n✓ ${ajouts} pattern(s) ajouté(s), ${modifs} modifié(s). Total : ${patterns.length} patterns.`);
process.exit(0);
