// ============================================================
// Catalogue produits — prix de VENTE de référence
// Le prix d'ACHAT est saisi manuellement par le patron via /admin
// ============================================================

export const CATEGORIES = [
  'outillage', 'document', 'agriculture', 'mecanique', 'nourriture', 'divers'
];

export const CATEGORY_LABELS = {
  outillage:   'Outillage',
  document:    'Document',
  agriculture: 'Agriculture',
  mecanique:   'Mécanique',
  nourriture:  'Nourriture',
  divers:      'Divers'
};

export const CATALOGUE = [
  // OUTILLAGE
  { id: 'grosse-perceuse-rouge',   nom: 'Grosse Perceuse rouge',   categorie: 'outillage',   prixVente: 15 },
  { id: 'foret-perceuse',          nom: 'Forêt de Perceuse',       categorie: 'outillage',   prixVente: 600 },
  { id: 'pince-plaque',            nom: 'Pince pour Plaque',       categorie: 'outillage',   prixVente: 25 },
  { id: 'pince-coupante',          nom: 'Pince Coupante',          categorie: 'outillage',   prixVente: 20 },
  { id: 'cisaille',                nom: 'Cisaille',                categorie: 'outillage',   prixVente: 1500 },
  { id: 'batterie',                nom: 'Batterie',                categorie: 'outillage',   prixVente: 10 },

  // DOCUMENT
  { id: 'porte-document',          nom: 'Porte Document',          categorie: 'document',    prixVente: 8 },
  { id: 'porte-feuille',           nom: 'Porte Feuille',           categorie: 'document',    prixVente: 8 },
  { id: 'trousseau-clefs',         nom: 'Trousseau de Clefs',      categorie: 'document',    prixVente: 80 },
  { id: 'colle',                   nom: 'Colle',                   categorie: 'document',    prixVente: 2 },
  { id: 'encre',                   nom: 'Encre',                   categorie: 'document',    prixVente: 4 },

  // AGRICULTURE
  { id: 'table',                   nom: 'Table',                   categorie: 'agriculture', prixVente: 10 },
  { id: 'pot-fleur',               nom: 'Pot de Fleur',            categorie: 'agriculture', prixVente: 10 },
  { id: 'fertilisant',             nom: 'Fertilisant',             categorie: 'agriculture', prixVente: 10 },
  { id: 'tas-terre',               nom: 'Tas de terre',            categorie: 'agriculture', prixVente: 14 },
  { id: 'lumiere-violette',        nom: 'Lumière Violette',        categorie: 'agriculture', prixVente: 20 },
  { id: 'corde',                   nom: 'Corde',                   categorie: 'agriculture', prixVente: 10 },
  { id: 'fillet',                  nom: 'Fillet',                  categorie: 'agriculture', prixVente: 10 },
  { id: 'sac-jute',                nom: 'Sac en Jute',             categorie: 'agriculture', prixVente: 0,
    note: 'Rupture possible — prix à confirmer' },

  // MÉCANIQUE
  { id: 'huile',                   nom: 'Huile',                   categorie: 'mecanique',   prixVente: 8 },
  { id: 'huile-shell',             nom: 'Huile Shell',             categorie: 'mecanique',   prixVente: 12 },
  { id: 'huile-noire',             nom: 'Huile Noire',             categorie: 'mecanique',   prixVente: 15 },
  { id: 'batterie-voiture',        nom: 'Batterie de Voiture',     categorie: 'mecanique',   prixVente: 20 },
  { id: 'solvant',                 nom: 'Solvant',                 categorie: 'mecanique',   prixVente: 25 },
  { id: 'caoutchouc',              nom: 'Caoutchouc',              categorie: 'mecanique',   prixVente: 6,
    note: 'Compté pour quota pompiste' },

  // NOURRITURE
  { id: 'menu-burger',             nom: 'Menu Burger ice tea',     categorie: 'nourriture',  prixVente: 90 },
  { id: 'barre-chocolatee',        nom: 'Barre chocolatée',        categorie: 'nourriture',  prixVente: 18 },
  { id: 'bonbon',                  nom: 'Bonbon',                  categorie: 'nourriture',  prixVente: 7 },
  { id: 'bonbon-cola',             nom: 'Bonbon Cola',             categorie: 'nourriture',  prixVente: 7 },
  { id: 'bonbon-tada',             nom: 'Bonbon Tada',             categorie: 'nourriture',  prixVente: 7 },
  { id: 'bonbon-drag',             nom: 'Bonbon Drag',             categorie: 'nourriture',  prixVente: 7 },
  { id: 'creme-glacee',            nom: 'Crème Glacée',            categorie: 'nourriture',  prixVente: 2 },
  { id: 'tortilla',                nom: 'Tortilla',                categorie: 'nourriture',  prixVente: 2 },
  { id: 'coquille-tacos',          nom: 'Coquille à Tacos',        categorie: 'nourriture',  prixVente: 2 },
  { id: 'moutarde',                nom: 'Moutarde',                categorie: 'nourriture',  prixVente: 2 },
  { id: 'cola-zero',               nom: 'Cola Zero Sucre',         categorie: 'nourriture',  prixVente: 4 },
  { id: 'brique-citron',           nom: 'Brique de citron',        categorie: 'nourriture',  prixVente: 15 },
  { id: 'pistache',                nom: 'Pistache',                categorie: 'nourriture',  prixVente: 8 },
  { id: 'noix',                    nom: 'Noix',                    categorie: 'nourriture',  prixVente: 8 },
  { id: 'noix-cajou',              nom: 'Noix de Cajou',           categorie: 'nourriture',  prixVente: 8 },

  // DIVERS
  { id: 'eponge-nettoyage',        nom: 'Éponge Nettoyage',        categorie: 'divers',      prixVente: 1000 },
  { id: 'bouteille-eau',           nom: "Bouteille d'eau",         categorie: 'divers',      prixVente: 10 },
  { id: 'bouteille-eau-purifiee',  nom: "Bouteille d'eau purifiée", categorie: 'divers',     prixVente: 2 },
  { id: 'ticket-gratter',          nom: 'Ticket à Gratter',        categorie: 'divers',      prixVente: 25 },
  { id: 'papier-rouler',           nom: 'Papier à Rouler',         categorie: 'divers',      prixVente: 2 },
  { id: 'spray-tag',               nom: 'Spray à tag',             categorie: 'divers',      prixVente: 2300 },
  { id: 'skate-board',             nom: 'Skate Board',             categorie: 'divers',      prixVente: 80 },
  { id: 'ballon-foot',             nom: 'Ballon de Foot',          categorie: 'divers',      prixVente: 40 },
  { id: 'ballon-basket',           nom: 'Ballon de Basket',        categorie: 'divers',      prixVente: 40 },
  { id: 'canne-peche',             nom: 'Canne à pêche',           categorie: 'divers',      prixVente: 64 },
  { id: 'appat-grande-qualite',    nom: 'Appât de Grande Qualité', categorie: 'divers',      prixVente: 10 },
  { id: 'bicarbonate-soude',       nom: 'Bicarbonate de soude',    categorie: 'divers',      prixVente: 2 },
  { id: 'croquette',               nom: 'Croquette',               categorie: 'divers',      prixVente: 30 },
  { id: 'herisson',                nom: 'Hérisson',                categorie: 'divers',      prixVente: 2 },
  { id: 'elastique',               nom: 'Élastique',               categorie: 'divers',      prixVente: 20 },
  { id: 'bidon-peinture',          nom: 'Bidon de Peinture',       categorie: 'divers',      prixVente: 4 },

  // Pompistes — bidon d'essence (compté pour quota)
  { id: 'bidon-essence',           nom: "Bidon d'essence",         categorie: 'mecanique',   prixVente: 0,
    note: 'Compté pour quota pompiste' }
];

// Items spéciaux pour quotas pompistes (ID logs-ig)
export const ITEM_BIDON      = 'bidon-essence';
export const ITEM_CAOUTCHOUC = 'caoutchouc';
