// Création des produits de craft + bascule des produits existants
// vers les bonnes sections (fabrication / achat fournisseur).
// Usage : node scripts/init-craft-produits.js [--apply]
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');
console.log(APPLY ? 'MODE: APPLY' : 'MODE: DRY-RUN');
console.log('');

// === NOUVEAUX PRODUITS À CRÉER ===
const nouveaux = [
  // --- Matières premières (achat fournisseur, intrant=true) ---
  {
    id: 'charbon',
    data: {
      nom: 'Charbon',
      categorie: 'matiere_premiere',
      prixAchat: 10,
      prixVente: 0,
      seuilAlerte: 10,
      intrant: true,
      pourPro: false,
      enFabrication: false,
      fournisseur: '',
      note: 'Intrant craft — prix unitaire 10$ d\'après recettes'
    }
  },
  {
    id: 'bobine-cuivre',
    data: {
      nom: 'Bobine de cuivre',
      categorie: 'matiere_premiere',
      prixAchat: 18.75,
      prixVente: 0,
      seuilAlerte: 10,
      intrant: true,
      pourPro: false,
      enFabrication: false,
      fournisseur: '',
      note: 'Intrant craft Plomberie / Câble électrique'
    }
  },
  {
    id: 'tissu',
    data: {
      nom: 'Tissu',
      categorie: 'matiere_premiere',
      prixAchat: 0,
      prixVente: 0,
      seuilAlerte: 5,
      intrant: true,
      pourPro: false,
      enFabrication: false,
      fournisseur: '',
      note: 'Intrant craft Sac en jute — fournisseur et prix à renseigner'
    }
  },

  // --- Produits finaux craftés (vendables particuliers, commission) ---
  {
    id: 'visseries',
    data: {
      nom: 'Visseries',
      categorie: 'outillage',
      prixAchat: 26,
      prixVente: 65,
      seuilAlerte: 10,
      intrant: false,
      pourPro: false,
      enFabrication: true,
      fournisseur: '',
      note: 'Crafté : 1×Charbon + 3×Acier → 5×Visseries (38$ TEMP si acier 60$)'
    }
  },
  {
    id: 'pioche',
    data: {
      nom: 'Pioche',
      categorie: 'outillage',
      prixAchat: 11.82,
      prixVente: 29.55,
      seuilAlerte: 5,
      intrant: false,
      pourPro: false,
      enFabrication: true,
      fournisseur: '',
      note: 'Crafté : 1×Charbon + 3×Acier → 11×Pioches (17.27$ TEMP si acier 60$)'
    }
  },
  {
    id: 'jerrican',
    data: {
      nom: 'Jerrican',
      categorie: 'auto',
      prixAchat: 7.50,
      prixVente: 18.75,
      seuilAlerte: 5,
      intrant: false,
      pourPro: false,
      enFabrication: true,
      fournisseur: '',
      note: 'Crafté : 4×Caoutchouc + 1×Bidon vide → 3×Jerricans'
    }
  },

  // --- Composants intermédiaires (craftés mais NON vendables — intrant=true bloque modal vente) ---
  {
    id: 'plomberie',
    data: {
      nom: 'Plomberie',
      categorie: 'divers',
      prixAchat: 131.75,
      prixVente: 0,
      seuilAlerte: 2,
      intrant: true,        // bloque modal vente
      pourPro: false,
      enFabrication: true,  // priorité : section "fabrication"
      fournisseur: '',
      note: 'Composant intermédiaire — utilisé pour Lumière violette. Crafté : 1×Charbon + 2×Cuivre + 5×Bobine → 1×Plomberie'
    }
  },
  {
    id: 'cable-electrique',
    data: {
      nom: 'Câble électrique',
      categorie: 'electronique',
      prixAchat: 122.50,
      prixVente: 0,
      seuilAlerte: 2,
      intrant: true,
      pourPro: false,
      enFabrication: true,
      fournisseur: '',
      note: 'Composant intermédiaire — utilisé pour Lumière violette. Crafté : 1×Charbon + 6×Bobine → 1×Câble'
    }
  }
];

// === MODIFICATIONS DE PRODUITS EXISTANTS ===
const modifs = [
  // Bidon vide = bidon-essence : pas vendable, sert uniquement aux stations
  { id: 'bidon-essence', patch: { intrant: true, pourPro: false, enFabrication: false, prixVente: 0 } },
  // Lumière violette : déplacer en fabrication (prix laissé tel quel)
  { id: 'lumiere-violette', patch: { enFabrication: true, pourPro: false, intrant: false } },
  // Filet : déplacer en fabrication
  { id: 'fillet', patch: { enFabrication: true, pourPro: false, intrant: false } },
  // Sac en jute : déplacer en fabrication (bloqué par prix tissu)
  { id: 'sac-jute', patch: { enFabrication: true, pourPro: false, intrant: false } }
];

// === Exécution : création ===
console.log('=== NOUVEAUX PRODUITS ===');
for (const p of nouveaux) {
  const existing = await db.collection('produits').doc(p.id).get();
  if (existing.exists) {
    console.log(`  ⚠ ${p.id} : existe déjà, ignoré (utiliser le module édition stocks)`);
    continue;
  }
  console.log(`  + ${p.id.padEnd(20)} | ${p.data.nom.padEnd(20)} | ${p.data.categorie} | achat=${p.data.prixAchat}$ vente=${p.data.prixVente}$`);
  if (APPLY) {
    await db.collection('produits').doc(p.id).set({
      ...p.data,
      derniereMaj: FieldValue.serverTimestamp()
    });
    // Stock initial à 0
    await db.collection('stocks').doc(p.id).set({
      nom: p.data.nom,
      quantite: 0,
      seuilAlerte: p.data.seuilAlerte,
      derniereMaj: FieldValue.serverTimestamp(),
      par: 'init-craft-produits'
    }, { merge: true });
  }
}

console.log('\n=== MODIFICATIONS DE PRODUITS EXISTANTS ===');
for (const m of modifs) {
  const snap = await db.collection('produits').doc(m.id).get();
  if (!snap.exists) { console.log(`  ⚠ ${m.id} : produit absent`); continue; }
  const p = snap.data();
  const dirSection = (data) => {
    if (data.enFabrication) return 'fabrication';
    if (data.intrant)       return 'achat_fournisseur';
    if (data.pourPro)       return 'vente_pro';
    return 'vente_epicerie';
  };
  const sectionAvant = dirSection(p);
  const sectionApres = dirSection({ ...p, ...m.patch });
  console.log(`  ~ ${m.id.padEnd(20)} | ${(p.nom || '').padEnd(20)} | ${sectionAvant} -> ${sectionApres}`);
  if (APPLY) {
    await snap.ref.set(m.patch, { merge: true });
  }
}

console.log('');
if (!APPLY) console.log('Relance avec --apply pour modifier.');
process.exit(0);
