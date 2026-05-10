// ============================================================
// Mapping nom FiveM (display) → ID catalogue interne
// ============================================================
// Source : export manuel des coffres LTD du 2026-05-10
// Le matching est insensible à la casse, aux accents, aux espaces
// et aux traits d'union/underscores via normalize().
// ============================================================
// Si un item ne figure pas dans cette table, le parser inventory
// le SKIP silencieusement (pas d'écriture en base, pas d'alerte).
// ============================================================

// Préfixes de coffres LTD légitimes (le source FiveM est sous la forme
// "action-XXXXX-0-N"). On filtre sur le préfixe "action-XXXXX".
// Tout mouvement venant d'un autre source = inventaire perso, coffre
// maison ou véhicule → ignoré.
// TODO: ajouter les préfixes des 8 coffres station-essence dès export user.
export const SOURCES_LTD_PREFIXES = [
  'action-27310', // Épicerie  : boissons, confiserie, alimentaire
  'action-27166', // Matériel  : divers, outillage, jardinage, mobilier
  'action-30439'  // Entrepôt  : matières premières, auto, craft
];

// Table : nom FiveM affiché (tel qu'observé en jeu) → ID catalogue
const RAW_MAPPING = {
  // Boissons
  "Bouteille d'Eau":       'bouteille-eau',
  "Eau purifiée":          'bouteille-eau-purifiee',
  "Jus de raisin rouge":   'jus-raisin-rouge',
  "Koffi Caramel":         'koffi-caramel',
  "Milkshake protéiné":    'milkshake-proteine',
  "Whey fraise":           'whey-fraise',
  "Whey zero":             'whey-zero',
  "Pure Whey":             'pure-whey',
  "Protéine Energy":       'proteine-energy',
  "Prot Muscle2000":       'prot-muscle-2000',
  "Protéine Vegan":        'proteine-vegan',

  // Alimentaire
  "Noix":                  'noix',
  "Baguette":              'baguette',
  "Pistache":              'pistache',
  "Crème glacée":          'creme-glacee',
  "Crème fraîche":         'creme-fraiche',
  "Tortilla":              'tortilla',
  "Coquille à tacos":      'coquille-tacos',
  "Bicarbonate de soude":  'bicarbonate-soude',
  "Pain à burger":         'pain-burger',
  "Pâtes":                 'pates',
  "Nouille":               'nouille',
  "Effiloché de Mouton":   'effiloche-mouton',
  "Pastelitos":            'pastelitos',
  "Picadillo":             'picadillo',

  // Confiserie
  "Bonbon":                'bonbon',
  "Bonbon cola":           'bonbon-cola',
  "Bonbon Tada":           'bonbon-tada',
  "Bonbon Drag":           'bonbon-drag',
  "Chewing gum citron":    'chewing-gum-citron',
  "Chewing Gum cerise":    'chewing-gum-cerise',
  "Bar de chocolat":       'barre-chocolatee',
  "Caramel":               'barre-choco-caramel',
  "Barre énergétique":     'barre-energetique',
  "Fontaine de chocolat":  'fontaine-chocolat',
  "Chocolat":              'chocolat',

  // Outillage
  "Grosse Perceuse":       'grosse-perceuse-rouge',
  "Perceuse":              'perceuse',
  "Perceuse manuel":       'perceuse-manuel',
  "Pince pour plaque":     'pince-plaque',
  "Pince coupante":        'pince-coupante',
  "Cisailles":             'cisaille',
  "Outil":                 'outil',

  // Jardinage
  "Pot de fleur":          'pot-fleur',
  "Fertilisant":           'fertilisant',
  "Tas de Terre":          'tas-terre',
  "Bac de jardinage":      'bac-jardinage',

  // Mobilier
  "Table de travail":      'table',

  // Électronique
  "Batterie":              'batterie',

  // Auto
  "Huile Jaune":           'huile',
  "Huile noir":            'huile-noire',
  "Batterie de voiture":   'batterie-voiture',
  "Eponge pour voiture":   'eponge-voiture',

  // Matière première
  "Caoutchouc":            'caoutchouc',
  "Acier":                 'acier',
  "Cuivre":                'cuivre',
  "Fève de Cacao":         'feve-cacao',

  // Pêche
  "Canne à pêche":         'canne-peche',
  "Appât grande qualité":  'appat-grande-qualite',

  // Emballage
  "Sachet vide":           'sachet-vide',

  // Variantes typos observées sur #ventes (canal ventes-auto FiveM)
  "Crème Glaci":           'creme-glacee',
  "Crème Fruiche":         'creme-fraiche',

  // Divers
  "Porte document":        'porte-document',
  "Porte feuille":         'porte-feuille',
  "Trousseau de clé":      'trousseau-clefs',
  "Colle":                 'colle',
  "Encre":                 'encre',
  "Corde":                 'corde',
  "Lumière violette":      'lumiere-violette',
  "Solvant":               'solvant',
  "Eponge":                'eponge-nettoyage',
  "Papier à rouler":       'papier-rouler',
  "Spray pour tag":        'spray-tag',
  "spray":                 'spray-tag', // nom interne FiveM (logs-ig)
  "Balle de basket":       'ballon-basket',
  "Balle de football":     'ballon-foot',
  "Croquettes":            'croquette',
  "Hérisson":              'herisson',
  "Élastique":             'elastique',
  "Bidon peinture":        'bidon-peinture'
};

// Normalisation pour rendre la lookup robuste : lowercase, suppression des
// accents, des espaces, des tirets, des underscores et du suffixe "$".
// Permet de matcher "Caramel 2$" → "caramel" → barre-choco-caramel.
function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s*\d+\s*\$\s*$/u, '') // strip trailing " 4$" / "20$"
    .replace(/[\s_\-]+/g, '');
}

const NORMALIZED_MAPPING = Object.fromEntries(
  Object.entries(RAW_MAPPING).map(([k, v]) => [normalizeKey(k), v])
);

/**
 * Résout le nom FiveM brut vers un ID catalogue.
 * Retourne null si l'item n'est pas mappé (le caller doit alors skip).
 */
export function resolveItemId(rawItem) {
  if (!rawItem) return null;
  const key = normalizeKey(rawItem);
  return NORMALIZED_MAPPING[key] || null;
}

/**
 * Vérifie qu'un `source` FiveM (ex: "action-27310-0-1") est un coffre LTD.
 * Compare uniquement le préfixe "action-XXXXX".
 */
export function isLtdSource(source) {
  if (!source) return false;
  const prefix = String(source).split('-').slice(0, 2).join('-');
  return SOURCES_LTD_PREFIXES.includes(prefix);
}
