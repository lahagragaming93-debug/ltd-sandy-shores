// ============================================================
// Permissions par rôle — LTD Sandy Shores
// ============================================================

export const ROLES = {
  PATRON:                 'patron',
  CO_PATRON:              'co-patron',
  DRH:                    'drh',
  RESP_VENTE:             'responsable-vente',
  RESP_POMPISTE:          'responsable-pompiste',
  VENDEUR_NOVICE:         'vendeur-novice',
  VENDEUR_INTER:          'vendeur-intermediaire',
  VENDEUR_EXP:            'vendeur-experimente',
  POMPISTE_NOVICE:        'pompiste-novice',
  POMPISTE_INTER:         'pompiste-intermediaire',
  POMPISTE_EXP:           'pompiste-experimente',
  // Rôle TECHNIQUE temporaire (passation, support assistant)
  // Tous les droits du Patron côté UI/Admin, mais EXCLU des calculs financiers
  // (compta, masse salariale, salaires, effectif RH).
  ADMIN_TECHNIQUE:        'admin-technique'
};

export const ROLE_LABELS = {
  'patron':                  'Patron',
  'co-patron':               'Co-Patron',
  'drh':                     'DRH',
  'responsable-vente':       'Responsable Vente',
  'responsable-pompiste':    'Responsable Pompiste',
  'vendeur-novice':          'Vendeur Novice',
  'vendeur-intermediaire':   'Vendeur Intermédiaire',
  'vendeur-experimente':     'Vendeur Expérimenté',
  'pompiste-novice':         'Pompiste Novice',
  'pompiste-intermediaire':  'Pompiste Intermédiaire',
  'pompiste-experimente':    'Pompiste Expérimenté',
  'admin-technique':         'Admin Technique'
};

const DIRECTION = ['patron', 'co-patron'];
const SUPER_ADMINS = ['admin-technique'];
const LECTURE_COMPTA = [...DIRECTION, 'drh', ...SUPER_ADMINS];
const RH_FULL = [...DIRECTION, 'drh', ...SUPER_ADMINS];
const VENDEURS = ['vendeur-novice', 'vendeur-intermediaire', 'vendeur-experimente'];
const POMPISTES = ['pompiste-novice', 'pompiste-intermediaire', 'pompiste-experimente'];

export const ACCESS = {
  dashboard:         [...DIRECTION, 'drh', ...SUPER_ADMINS],
  stocks_epicerie:   [...DIRECTION, 'drh', 'responsable-vente', 'responsable-pompiste', ...SUPER_ADMINS],
  stocks_essence:    [...DIRECTION, 'drh', 'responsable-pompiste', ...SUPER_ADMINS],
  ventes:            [...DIRECTION, 'drh', 'responsable-vente', ...SUPER_ADMINS],
  comptabilite:      LECTURE_COMPTA,
  comptabilite_edit: [...DIRECTION, ...SUPER_ADMINS],
  rh:                RH_FULL,
  stations:          [...DIRECTION, 'drh', 'responsable-pompiste', ...POMPISTES, ...SUPER_ADMINS],
  // Banque LTD : direction + DRH + super-admin (audit financier sensible)
  banque:            [...DIRECTION, 'drh', ...SUPER_ADMINS],
  // Revenus carburant : direction + DRH + responsable pompiste (pilotage stations)
  revenus_carburant: [...DIRECTION, 'drh', 'responsable-pompiste', ...SUPER_ADMINS],
  // Admin : direction + DRH + responsables + super-admins
  admin:             [...DIRECTION, 'drh', 'responsable-vente', 'responsable-pompiste', ...SUPER_ADMINS],
  // Notes de frais (validation + remboursement) : direction + DRH + resp-pompiste
  notes_frais:       [...DIRECTION, 'drh', 'responsable-pompiste', ...SUPER_ADMINS],
  employee:          [...DIRECTION, 'drh', ...VENDEURS, ...POMPISTES,
                      'responsable-vente', 'responsable-pompiste', ...SUPER_ADMINS],
  paies:             [...DIRECTION, 'drh', ...VENDEURS, ...POMPISTES,
                      'responsable-vente', 'responsable-pompiste', ...SUPER_ADMINS],
  guide:             [...DIRECTION, 'drh', ...VENDEURS, ...POMPISTES,
                      'responsable-vente', 'responsable-pompiste', ...SUPER_ADMINS],
  tuto:              [...DIRECTION, 'drh', ...VENDEURS, ...POMPISTES,
                      'responsable-vente', 'responsable-pompiste', ...SUPER_ADMINS]
};

export function canAccess(role, page) {
  const allowed = ACCESS[page];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function isDirection(role)    { return DIRECTION.includes(role); }
export function isVendeur(role)      { return VENDEURS.includes(role); }
export function isPompiste(role)     { return POMPISTES.includes(role); }
export function isResponsable(role)  { return role === 'responsable-vente' || role === 'responsable-pompiste'; }
export function isSuperAdmin(role)   { return SUPER_ADMINS.includes(role); }
export function isEmployeeView(role) {
  return isVendeur(role) || isPompiste(role);
}

// Peut effectuer des actions pompiste (ravitailler une station, corriger
// un stock, déclarer caoutchoucs, note de frais essence) ?
// → pompistes classiques + responsable-pompiste (qui pilote l'équipe MAIS
//   peut aussi rouler en station si besoin). NB : son salaire reste fixe
//   (cf. salaireResponsablePompiste dans utils/paie.js) — ses ravits sont
//   tracés (collection /redistributionsPompiste, agrégats /quotasPompiste)
//   mais n'impactent PAS son propre salaire estimé.
export function isPompisteRavitailleur(role) {
  return isPompiste(role) || role === 'responsable-pompiste';
}
// Idem pour les ventes : vendeur-* + responsable-vente peut déclarer une
// vente (utile si le RV dépanne un client), mais sans CA personnel.
export function isVendeurDeclarateur(role) {
  return isVendeur(role) || role === 'responsable-vente';
}

// Le rôle est-il pris en compte dans les calculs financiers
// (masse salariale, salaires affichés en compta, effectif RH facturable) ?
// Les admin-technique sont EXCLUS — c'est leur raison d'être.
export function compteEnFinance(role) {
  return !isSuperAdmin(role);
}

// ============================================================
// Hiérarchie de gestion des comptes
// ============================================================
// canManageUser(currentRole, targetRole) : currentRole peut-il créer/modifier/
// suspendre/supprimer un compte ayant targetRole ?
//
//   Patron        : tout
//   Co-Patron     : tout sauf Patron
//   DRH           : tout sauf Patron, Co-Patron (peut gérer un autre DRH)
//   Resp Vente    : uniquement vendeur-novice / vendeur-intermediaire / vendeur-experimente
//   Resp Pompiste : uniquement pompiste-novice / pompiste-intermediaire / pompiste-experimente
//   Autres rôles  : aucun (les vendeurs/pompistes ne gèrent personne)
export function canManageUser(currentRole, targetRole) {
  if (!currentRole || !targetRole) return false;
  // Super-admin technique : tous les droits, peut tout gérer (lui-même inclus)
  if (currentRole === 'admin-technique') return true;
  // Patron : tout, y compris admin-technique (sécurité — peut le retirer)
  if (currentRole === 'patron') return true;
  // Co-Patron : tout sauf Patron et Admin Technique
  if (currentRole === 'co-patron') return targetRole !== 'patron' && targetRole !== 'admin-technique';
  // DRH : tout sauf direction et admin-technique
  if (currentRole === 'drh') {
    return targetRole !== 'patron' && targetRole !== 'co-patron' && targetRole !== 'admin-technique';
  }
  if (currentRole === 'responsable-vente')   return VENDEURS.includes(targetRole);
  if (currentRole === 'responsable-pompiste')return POMPISTES.includes(targetRole);
  return false;
}

// Liste des rôles qu'un utilisateur peut assigner (création + changement de rôle)
export function assignableRoles(currentRole) {
  return Object.values(ROLES).filter(r => canManageUser(currentRole, r));
}

// La configuration globale (quotas, prix essence, webhook) : direction + super-admin
export function canEditConfig(role) {
  return isDirection(role) || isSuperAdmin(role);
}

// Création d'un nouveau produit dans le catalogue : direction + DRH + Resp Pompiste + super-admin
// 2026-05-22 : Resp Pompiste ajoute (demande patron — gestion complete des stocks epicerie).
export function canCreateProduit(role) {
  return isDirection(role) || role === 'drh' || role === 'responsable-pompiste' || isSuperAdmin(role);
}

export function defaultLandingPage(role) {
  if (isSuperAdmin(role)) return 'dashboard.html';
  if (isDirection(role) || role === 'drh') return 'dashboard.html';
  if (role === 'responsable-vente') return 'ventes.html';
  if (role === 'responsable-pompiste') return 'stations.html';
  return 'employee.html';
}

// Plafonds salaire (TTE Chap. IV - Secteur 2)
// admin-technique : 0 — il ne perçoit aucun salaire (rôle technique non rémunéré)
// drh : 18 000 $ FIXE (decision patron 2026-05-14, pas de variable)
export const PLAFOND_SALAIRE = {
  'patron':                   20000,
  'co-patron':                20000,
  'drh':                      18000,
  'responsable-vente':        17000,
  'responsable-pompiste':     17000,
  'vendeur-novice':           13000,
  'vendeur-intermediaire':    14000,
  'vendeur-experimente':      15000,
  'pompiste-novice':          13000,
  'pompiste-intermediaire':   14000,
  'pompiste-experimente':     15000,
  'admin-technique':          0
};

// Salaire DRH : montant FIXE (pas decide). Decision patron 2026-05-14.
export const DRH_SALAIRE_FIXE = 18000;

// LEGACY (non utilisee depuis 2026-05-24) : le responsable vente est desormais
// traite EXACTEMENT comme le responsable pompiste — salaire fixe au plafond
// (17 000 $) ou montant decide par le patron. Ses ventes/crafts ne sont PAS
// commissionnes. Constante conservee pour ne pas casser d'eventuels imports
// historiques mais plus utilisee dans le calcul de paie.
export const CA_PLAFOND_RESP_VENTE = 40000;

// === Vendeurs : systeme prorata CA + bonus quota fabrication ===
//
// Decision patron 2026-05-25 :
//   quotaCAVendeur = 50 000        (cible CA hebdo commissionnable)
//   plafond part CA = 8 / 9 / 10k  (novice / inter / exp)
//   bonus quota fab max = 5 000$   (score moyen × 5 000)
//   plafond total inchange = 13 / 14 / 15k (= plafondCA + bonusMax)
//
// Formule :
//   partCA   = MIN(CA / quotaCAVendeur, 1) × PLAFOND_CA_VENDEUR[role]
//   bonusFab = scoreQuotaFabrication(fab, quotaFab) × BONUS_QUOTA_VENDEUR_MAX
//   salaire  = MIN(partCA + bonusFab, PLAFOND_SALAIRE[role])
//
// Pour atteindre le plafond plein (13/14/15k) : 50 000 $ de CA commissionnable
// ET 100 % du quota fabrication.
//
// Le patron pilote la cible CA via config.quotaCAVendeur (panel RH > Quotas
// hebdo). Tant que quotaCAVendeur > 0, le systeme nouveau s'applique.
//
// Cf. /02-drh.md et /05-vendeur.md pour la doc.

// Garde defensif : la formule prorata n'a de sens que pour un quotaCAVendeur
// strictement positif (sinon division par zero). Accepte cfg ou valeur brute.
export function isNouveauSystemeVendeur(cfgOrQuotaCA) {
  const q = (cfgOrQuotaCA && typeof cfgOrQuotaCA === 'object')
    ? Number(cfgOrQuotaCA.quotaCAVendeur ?? QUOTA_CA_VENDEUR_DEFAULT)
    : Number(cfgOrQuotaCA);
  return Number.isFinite(q) && q > 0;
}

export const PLAFOND_CA_VENDEUR = {
  'vendeur-novice':         8000,
  'vendeur-intermediaire':  9000,
  'vendeur-experimente':    10000
};
export const BONUS_QUOTA_VENDEUR_MAX = 5000;
export const PRODUITS_QUOTA_FAB = [
  'bouteille-eau-purifiee',
  'mastic-carrosserie',
  'visseries',
  'pain-burger',
  'lumiere-violette'
];

// Valeur par defaut quand config.quotaCAVendeur est absent en Firestore.
// = nouvelle cible CA depuis 2026-05-25.
export const QUOTA_CA_VENDEUR_DEFAULT = 50000;
