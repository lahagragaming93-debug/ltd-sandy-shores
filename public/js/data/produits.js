// ============================================================
// Catalogue produits — prix de VENTE de référence
// Le prix d'ACHAT est saisi manuellement par le patron via /admin
// ============================================================
// Catégories alignées sur l'inventaire FiveM réel (export 2026-05-10)
// ============================================================

export const CATEGORIES = [
  'boissons', 'alimentaire', 'confiserie',
  'outillage', 'jardinage', 'mobilier',
  'electronique', 'auto', 'matiere_premiere',
  'peche', 'emballage', 'divers'
];

export const CATEGORY_LABELS = {
  boissons:         'Boissons',
  alimentaire:      'Alimentaire',
  confiserie:       'Confiserie',
  outillage:        'Outillage',
  jardinage:        'Jardinage',
  mobilier:         'Mobilier',
  electronique:     'Électronique',
  auto:             'Automobile',
  matiere_premiere: 'Matière première',
  peche:            'Pêche',
  emballage:        'Emballage',
  divers:           'Divers'
};

// prixVente = 0 et note "à compléter" pour items dont le prix n'est pas encore confirmé
export const CATALOGUE = [
  // BOISSONS
  { id: 'bouteille-eau',           nom: "Bouteille d'eau",         categorie: 'boissons',         prixVente: 10 },
  { id: 'bouteille-eau-purifiee',  nom: "Bouteille d'eau purifiée", categorie: 'boissons',        prixVente: 2 },
  { id: 'cola-zero',               nom: 'Cola Zero Sucre',         categorie: 'boissons',         prixVente: 4 },
  { id: 'brique-citron',           nom: 'Brique de citron',        categorie: 'boissons',         prixVente: 15 },
  { id: 'jus-raisin-rouge',        nom: 'Jus de raisin rouge',     categorie: 'boissons',         prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'koffi-caramel',           nom: 'Koffi Caramel',           categorie: 'boissons',         prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'milkshake-proteine',      nom: 'Milkshake protéiné',      categorie: 'boissons',         prixVente: 4 },
  { id: 'whey-fraise',             nom: 'Whey fraise',             categorie: 'boissons',         prixVente: 8 },
  { id: 'whey-zero',               nom: 'Whey zero',               categorie: 'boissons',         prixVente: 8 },
  { id: 'pure-whey',               nom: 'Pure Whey',               categorie: 'boissons',         prixVente: 4 },
  { id: 'proteine-energy',         nom: 'Protéine Energy',         categorie: 'boissons',         prixVente: 4 },
  { id: 'prot-muscle-2000',        nom: 'Prot Muscle2000',         categorie: 'boissons',         prixVente: 20 },
  { id: 'proteine-vegan',          nom: 'Protéine Vegan',          categorie: 'boissons',         prixVente: 0,
    note: 'Prix à confirmer' },

  // ALIMENTAIRE
  { id: 'menu-burger',             nom: 'Menu Burger ice tea',     categorie: 'alimentaire',      prixVente: 90 },
  { id: 'menu-simple',             nom: 'Menu simple',             categorie: 'alimentaire',      prixVente: 110 },
  { id: 'menu-complet',            nom: 'Menu complet',            categorie: 'alimentaire',      prixVente: 130 },
  { id: 'baguette',                nom: 'Baguette',                categorie: 'alimentaire',      prixVente: 15 },
  { id: 'tortilla',                nom: 'Tortilla',                categorie: 'alimentaire',      prixVente: 2 },
  { id: 'coquille-tacos',          nom: 'Coquille à Tacos',        categorie: 'alimentaire',      prixVente: 2 },
  { id: 'moutarde',                nom: 'Moutarde',                categorie: 'alimentaire',      prixVente: 2 },
  { id: 'pistache',                nom: 'Pistache',                categorie: 'alimentaire',      prixVente: 8 },
  { id: 'noix',                    nom: 'Noix',                    categorie: 'alimentaire',      prixVente: 8 },
  { id: 'noix-cajou',              nom: 'Noix de Cajou',           categorie: 'alimentaire',      prixVente: 8 },
  { id: 'creme-glacee-pot',        nom: 'Crème glacée pot',        categorie: 'alimentaire',      prixVente: 2 },
  { id: 'creme-glacee-cornet',     nom: 'Crème glacée cornet',     categorie: 'alimentaire',      prixVente: 2 },
  { id: 'creme-fraiche',           nom: 'Crème fraîche',           categorie: 'alimentaire',      prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'bicarbonate-soude',       nom: 'Bicarbonate de soude',    categorie: 'alimentaire',      prixVente: 2 },
  { id: 'pain-burger',             nom: 'Pain à burger',           categorie: 'alimentaire',      prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'pates',                   nom: 'Pâtes',                   categorie: 'alimentaire',      prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'nouille',                 nom: 'Nouille',                 categorie: 'alimentaire',      prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'effiloche-mouton',        nom: 'Effiloché de Mouton',     categorie: 'alimentaire',      prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'pastelitos',              nom: 'Pastelitos',              categorie: 'alimentaire',      prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'picadillo',               nom: 'Picadillo',               categorie: 'alimentaire',      prixVente: 0,
    note: 'Prix à confirmer' },

  // CONFISERIE
  { id: 'bonbon',                  nom: 'Bonbon',                  categorie: 'confiserie',       prixVente: 7 },
  { id: 'bonbon-cola',             nom: 'Bonbon Cola',             categorie: 'confiserie',       prixVente: 7 },
  { id: 'bonbon-tada',             nom: 'Bonbon Tada',             categorie: 'confiserie',       prixVente: 7 },
  { id: 'bonbon-drag',             nom: 'Bonbon Drag',             categorie: 'confiserie',       prixVente: 7 },
  { id: 'chewing-gum-citron',      nom: 'Chewing-gum citron',      categorie: 'confiserie',       prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'chewing-gum-cerise',      nom: 'Chewing-gum cerise',      categorie: 'confiserie',       prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'barre-chocolatee',        nom: 'Barre chocolatée',        categorie: 'confiserie',       prixVente: 18 },
  { id: 'barre-choco-caramel',     nom: 'Barre chocolatée caramel',categorie: 'confiserie',       prixVente: 18 },
  { id: 'barre-energetique',       nom: 'Barre énergétique',       categorie: 'confiserie',       prixVente: 4 },
  { id: 'fontaine-chocolat',       nom: 'Fontaine de chocolat',    categorie: 'confiserie',       prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'chocolat',                nom: 'Chocolat',                categorie: 'confiserie',       prixVente: 0,
    note: 'Prix à confirmer' },

  // OUTILLAGE
  { id: 'grosse-perceuse-rouge',   nom: 'Grosse Perceuse rouge',   categorie: 'outillage',        prixVente: 15 },
  { id: 'perceuse',                nom: 'Perceuse',                categorie: 'outillage',        prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'perceuse-manuel',         nom: 'Perceuse manuelle',       categorie: 'outillage',        prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'foret-perceuse',          nom: 'Forêt de Perceuse',       categorie: 'outillage',        prixVente: 600 },
  { id: 'pince-plaque',            nom: 'Pince pour Plaque',       categorie: 'outillage',        prixVente: 25 },
  { id: 'pince-coupante',          nom: 'Pince Coupante',          categorie: 'outillage',        prixVente: 20 },
  { id: 'cisaille',                nom: 'Cisaille',                categorie: 'outillage',        prixVente: 1500 },
  { id: 'outil',                   nom: 'Outil',                   categorie: 'outillage',        prixVente: 0,
    note: 'Outil générique — prix à confirmer' },

  // JARDINAGE
  { id: 'pot-fleur',               nom: 'Pot de Fleur',            categorie: 'jardinage',        prixVente: 10 },
  { id: 'fertilisant',             nom: 'Fertilisant',             categorie: 'jardinage',        prixVente: 10 },
  { id: 'tas-terre',               nom: 'Tas de terre',            categorie: 'jardinage',        prixVente: 14 },
  { id: 'bac-jardinage',           nom: 'Bac de jardinage',        categorie: 'jardinage',        prixVente: 20 },
  { id: 'fillet',                  nom: 'Fillet',                  categorie: 'jardinage',        prixVente: 10 },
  { id: 'sac-jute',                nom: 'Sac en Jute',             categorie: 'jardinage',        prixVente: 0,
    note: 'Rupture possible — prix à confirmer' },

  // MOBILIER
  { id: 'table',                   nom: 'Table de travail',        categorie: 'mobilier',         prixVente: 10 },

  // ÉLECTRONIQUE
  { id: 'batterie',                nom: 'Batterie',                categorie: 'electronique',     prixVente: 10 },
  { id: 'pile',                    nom: 'Pile',                    categorie: 'electronique',     prixVente: 2 },

  // AUTO
  { id: 'huile',                   nom: 'Huile',                   categorie: 'auto',             prixVente: 8 },
  { id: 'huile-shell',             nom: 'Huile Shell',             categorie: 'auto',             prixVente: 12 },
  { id: 'huile-noire',             nom: 'Huile Noire',             categorie: 'auto',             prixVente: 15 },
  { id: 'batterie-voiture',        nom: 'Batterie de Voiture',     categorie: 'auto',             prixVente: 20 },
  { id: 'eponge-voiture',          nom: 'Éponge pour voiture',     categorie: 'auto',             prixVente: 2 },
  { id: 'bidon-essence',           nom: "Bidon d'essence",         categorie: 'auto',             prixVente: 0,
    note: 'Compté pour quota pompiste' },

  // MATIÈRE PREMIÈRE
  { id: 'caoutchouc',              nom: 'Caoutchouc',              categorie: 'matiere_premiere', prixVente: 6,
    note: 'Compté pour quota pompiste' },
  { id: 'acier',                   nom: 'Acier',                   categorie: 'matiere_premiere', prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'cuivre',                  nom: 'Cuivre',                  categorie: 'matiere_premiere', prixVente: 0,
    note: 'Prix à confirmer' },
  { id: 'feve-cacao',              nom: 'Fève de Cacao',           categorie: 'matiere_premiere', prixVente: 0,
    note: 'Prix à confirmer' },

  // PÊCHE
  { id: 'canne-peche',             nom: 'Canne à pêche',           categorie: 'peche',            prixVente: 64 },
  { id: 'appat-grande-qualite',    nom: 'Appât de Grande Qualité', categorie: 'peche',            prixVente: 10 },

  // EMBALLAGE
  { id: 'sachet-vide',             nom: 'Sachet vide',             categorie: 'emballage',        prixVente: 0,
    note: 'Consommable — prix à confirmer' },

  // DIVERS
  { id: 'porte-document',          nom: 'Porte Document',          categorie: 'divers',           prixVente: 8 },
  { id: 'porte-feuille',           nom: 'Porte Feuille',           categorie: 'divers',           prixVente: 8 },
  { id: 'trousseau-clefs',         nom: 'Trousseau de Clefs',      categorie: 'divers',           prixVente: 80 },
  { id: 'colle',                   nom: 'Colle',                   categorie: 'divers',           prixVente: 2 },
  { id: 'encre',                   nom: 'Encre',                   categorie: 'divers',           prixVente: 4 },
  { id: 'corde',                   nom: 'Corde',                   categorie: 'divers',           prixVente: 10 },
  { id: 'lumiere-violette',        nom: 'Lumière Violette',        categorie: 'divers',           prixVente: 20 },
  { id: 'solvant',                 nom: 'Solvant',                 categorie: 'divers',           prixVente: 25 },
  { id: 'eponge-nettoyage',        nom: 'Éponge Nettoyage',        categorie: 'divers',           prixVente: 1000 },
  { id: 'ticket-gratter',          nom: 'Ticket à Gratter',        categorie: 'divers',           prixVente: 25 },
  { id: 'papier-rouler',           nom: 'Papier à Rouler',         categorie: 'divers',           prixVente: 2 },
  { id: 'spray-tag',               nom: 'Spray à tag',             categorie: 'divers',           prixVente: 2300 },
  { id: 'skate-board',             nom: 'Skate Board',             categorie: 'divers',           prixVente: 80 },
  { id: 'trottinette-electrique',  nom: 'Trottinette électrique',  categorie: 'divers',           prixVente: 500 },
  { id: 'ballon-foot',             nom: 'Ballon de Foot',          categorie: 'divers',           prixVente: 40 },
  { id: 'ballon-basket',           nom: 'Ballon de Basket',        categorie: 'divers',           prixVente: 40 },
  { id: 'croquette',               nom: 'Croquette',               categorie: 'divers',           prixVente: 30 },
  { id: 'herisson',                nom: 'Hérisson',                categorie: 'divers',           prixVente: 2 },
  { id: 'elastique',               nom: 'Élastique',               categorie: 'divers',           prixVente: 20 },
  { id: 'bidon-peinture',          nom: 'Bidon de Peinture',       categorie: 'divers',           prixVente: 4 }
];

// Items spéciaux pour quotas pompistes (ID logs-ig)
export const ITEM_BIDON      = 'bidon-essence';
export const ITEM_CAOUTCHOUC = 'caoutchouc';
