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
  POMPISTE_EXP:           'pompiste-experimente'
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
  'pompiste-experimente':    'Pompiste Expérimenté'
};

const DIRECTION = ['patron', 'co-patron'];
const LECTURE_COMPTA = [...DIRECTION, 'drh'];
const RH_FULL = [...DIRECTION, 'drh'];
const VENDEURS = ['vendeur-novice', 'vendeur-intermediaire', 'vendeur-experimente'];
const POMPISTES = ['pompiste-novice', 'pompiste-intermediaire', 'pompiste-experimente'];

export const ACCESS = {
  dashboard:         [...DIRECTION, 'drh'],
  stocks_epicerie:   [...DIRECTION, 'drh', 'responsable-vente'],
  stocks_essence:    [...DIRECTION, 'drh', 'responsable-pompiste'],
  ventes:            [...DIRECTION, 'drh', 'responsable-vente'],
  comptabilite:      LECTURE_COMPTA,
  comptabilite_edit: DIRECTION,
  rh:                RH_FULL,
  stations:          [...DIRECTION, 'responsable-pompiste'],
  // Admin : accessible à direction, DRH et responsables.
  // Le périmètre des actions (qui peut gérer qui) est contrôlé par canManageUser().
  admin:             [...DIRECTION, 'drh', 'responsable-vente', 'responsable-pompiste'],
  employee:          [...DIRECTION, 'drh', ...VENDEURS, ...POMPISTES,
                      'responsable-vente', 'responsable-pompiste'],
  // Mes paies : tout employé connecté actif
  paies:             [...DIRECTION, 'drh', ...VENDEURS, ...POMPISTES,
                      'responsable-vente', 'responsable-pompiste'],
  // Guide / Tutoriel : accessible à tous les rôles
  guide:             [...DIRECTION, 'drh', ...VENDEURS, ...POMPISTES,
                      'responsable-vente', 'responsable-pompiste']
};

export function canAccess(role, page) {
  const allowed = ACCESS[page];
  if (!allowed) return false;
  return allowed.includes(role);
}

export function isDirection(role)   { return DIRECTION.includes(role); }
export function isVendeur(role)     { return VENDEURS.includes(role); }
export function isPompiste(role)    { return POMPISTES.includes(role); }
export function isResponsable(role) { return role === 'responsable-vente' || role === 'responsable-pompiste'; }
export function isEmployeeView(role) {
  return isVendeur(role) || isPompiste(role);
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
  if (currentRole === 'patron') return true;
  if (currentRole === 'co-patron') return targetRole !== 'patron';
  if (currentRole === 'drh') {
    return targetRole !== 'patron' && targetRole !== 'co-patron';
  }
  if (currentRole === 'responsable-vente')   return VENDEURS.includes(targetRole);
  if (currentRole === 'responsable-pompiste')return POMPISTES.includes(targetRole);
  return false;
}

// Liste des rôles qu'un utilisateur peut assigner (création + changement de rôle)
export function assignableRoles(currentRole) {
  return Object.values(ROLES).filter(r => canManageUser(currentRole, r));
}

// La configuration globale (quotas, prix essence, webhook) reste réservée à la direction
export function canEditConfig(role) {
  return isDirection(role);
}

// Création d'un nouveau produit dans le catalogue : direction + DRH uniquement
// (la modification des prix/seuils existants reste accessible au Resp Vente)
export function canCreateProduit(role) {
  return isDirection(role) || role === 'drh';
}

export function defaultLandingPage(role) {
  if (isDirection(role) || role === 'drh') return 'dashboard.html';
  if (role === 'responsable-vente') return 'ventes.html';
  if (role === 'responsable-pompiste') return 'stations.html';
  return 'employee.html';
}

// Plafonds salaire (TTE Chap. IV - Secteur 2)
export const PLAFOND_SALAIRE = {
  'patron':                   20000,
  'co-patron':                20000,
  'drh':                      20000,
  'responsable-vente':        17000,
  'responsable-pompiste':     17000,
  'vendeur-novice':           13000,
  'vendeur-intermediaire':    14000,
  'vendeur-experimente':      15000,
  'pompiste-novice':          13000,
  'pompiste-intermediaire':   14000,
  'pompiste-experimente':     15000
};

export const COMMISSION_VENDEUR = {
  'vendeur-novice':         0.325,
  'vendeur-intermediaire':  0.350,
  'vendeur-experimente':    0.375
};

export const CA_PLAFOND_VENDEUR = 40000;
