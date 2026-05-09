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
  admin:             DIRECTION,
  employee:          [...DIRECTION, 'drh', ...VENDEURS, ...POMPISTES,
                      'responsable-vente', 'responsable-pompiste'],
  // Mes paies : tout employé connecté actif
  paies:             [...DIRECTION, 'drh', ...VENDEURS, ...POMPISTES,
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
