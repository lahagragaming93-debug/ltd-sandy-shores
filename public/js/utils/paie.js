// ============================================================
// Calcul de la paie — au prorata du travail réel
// Réf : prompt projet, conforme TTE Chap. IV — Secteur 2
// ============================================================

import { PLAFOND_SALAIRE, COMMISSION_VENDEUR, CA_PLAFOND_VENDEUR,
         CA_PLAFOND_RESP_VENTE, DRH_SALAIRE_FIXE,
         isVendeur, isPompiste, isResponsable, isDirection } from './permissions.js';

/**
 * Salaire vendeur — commission sur CA, plafond CA 40 000 $
 * @param {string} role
 * @param {number} caGenere     Chiffre d'affaires généré par le vendeur
 */
export function salaireVendeur(role, caGenere) {
  if (!isVendeur(role)) return 0;
  const commission = COMMISSION_VENDEUR[role] ?? 0;
  const plafondSalaire = PLAFOND_SALAIRE[role] ?? 0;
  const caRetenu = Math.min(caGenere || 0, CA_PLAFOND_VENDEUR);
  const brut = caRetenu * commission;
  return Math.min(Math.round(brut), plafondSalaire);
}

/**
 * Salaire pompiste — moyenne des deux quotas (bidons + caoutchoucs)
 */
export function salairePompiste(role, bidonsRealises, caoutchoucsRealises,
                                quotaBidons = 1700, quotaCaoutchoucs = 800) {
  if (!isPompiste(role)) return 0;
  const plafond = PLAFOND_SALAIRE[role] ?? 0;
  const sB = Math.min(1, (bidonsRealises ?? 0) / quotaBidons);
  const sC = Math.min(1, (caoutchoucsRealises ?? 0) / quotaCaoutchoucs);
  const score = (sB + sC) / 2;
  return Math.round(score * plafond);
}

/**
 * Salaire responsable VENTE — pro-rata sur CA personnel
 * Formule (decision patron 2026-05-14) : (CA / 40 000) × 17 000, plafonne a 17 000.
 * Memes regles d'attribution du CA qu'un vendeur (caParticulier).
 */
export function salaireResponsableVente(caGenere) {
  const plafond = PLAFOND_SALAIRE['responsable-vente'] ?? 17000;
  const ratio = Math.min(1, (caGenere || 0) / CA_PLAFOND_RESP_VENTE);
  return Math.min(Math.round(ratio * plafond), plafond);
}

/**
 * Salaire responsable POMPISTE — fixe (saisi manuellement par patron, plafond 17 000)
 * Si non decide (null) ou setté à 0 par erreur → fallback sur plafond.
 */
export function salaireResponsablePompiste(salaireDecide) {
  const plafond = PLAFOND_SALAIRE['responsable-pompiste'] ?? 17000;
  const v = (salaireDecide != null && salaireDecide > 0) ? salaireDecide : plafond;
  return Math.min(Math.round(v), plafond);
}

/**
 * Salaire direction — fixe au plafond
 * DRH : montant FIXE (18 000 $) impose par le patron, salaireDecide ignore.
 * Patron / Co-Patron : decide manuellement, plafond 20 000. Si non decide ou
 * setté à 0 par erreur → fallback sur le plafond (sinon ils n'apparaissent pas
 * dans la masse salariale, ce qui fausse les stats TTE).
 */
export function salaireDirection(role, salaireDecide) {
  if (role === 'drh') return DRH_SALAIRE_FIXE;
  if (!isDirection(role)) return 0;
  const plafond = PLAFOND_SALAIRE[role] ?? 0;
  const v = (salaireDecide != null && salaireDecide > 0) ? salaireDecide : plafond;
  return Math.min(Math.round(v), plafond);
}

/**
 * Calcule le salaire estimé d'un employé selon son rôle.
 * @param {object} e — fiche employé (role + métriques de la semaine)
 * @param {object} cfg — configuration (quotaBidons, quotaCaoutchoucs)
 */
export function salaireEstime(e, cfg = {}) {
  const quotaBidons = cfg.quotaBidons ?? 1700;
  const quotaCaoutchoucs = cfg.quotaCaoutchoucs ?? 800;

  if (isVendeur(e.role)) {
    return salaireVendeur(e.role, e.caGenere ?? 0);
  }
  if (isPompiste(e.role)) {
    return salairePompiste(e.role, e.bidonsRealises ?? 0,
                           e.caoutchoucsRealises ?? 0,
                           quotaBidons, quotaCaoutchoucs);
  }
  if (e.role === 'responsable-vente') {
    // Pro-rata sur CA personnel (depuis 2026-05-14)
    return salaireResponsableVente(e.caGenere ?? 0);
  }
  if (e.role === 'responsable-pompiste') {
    return salaireResponsablePompiste(e.salaireDecide ?? 0);
  }
  if (isDirection(e.role) || e.role === 'drh') {
    return salaireDirection(e.role, e.salaireDecide ?? PLAFOND_SALAIRE[e.role]);
  }
  return 0;
}

/**
 * Score pompiste en pourcentage — utilisé dans le dashboard employé.
 */
export function scorePompiste(bidons, caoutchoucs, quotaBidons = 1700, quotaCaoutchoucs = 800) {
  const sB = Math.min(1, (bidons ?? 0) / quotaBidons);
  const sC = Math.min(1, (caoutchoucs ?? 0) / quotaCaoutchoucs);
  return ((sB + sC) / 2) * 100;
}

// === Primes hebdomadaires (Art. 4-1.10) — tranches de CA ===
// Valeurs exemplatives — modifiables depuis le code si TTE évolue
export const PRIMES_HEBDO_TRANCHES = [
  { caMin: 0,        caMax: 200000,   prime: 0     },
  { caMin: 200000,   caMax: 400000,   prime: 5000  },
  { caMin: 400000,   caMax: 600000,   prime: 10000 },
  { caMin: 600000,   caMax: Infinity, prime: 15000 }
];

export function primeHebdo(ca) {
  const t = PRIMES_HEBDO_TRANCHES.find(t => ca >= t.caMin && ca < t.caMax);
  return t ? t.prime : 0;
}

export const PRIMES_MENSUELLES_TRANCHES = [
  { beneficeMin: 0,        beneficeMax: 500000,   prime: 0     },
  { beneficeMin: 500000,   beneficeMax: 1000000,  prime: 20000 },
  { beneficeMin: 1000000,  beneficeMax: 2000000,  prime: 40000 },
  { beneficeMin: 2000000,  beneficeMax: Infinity, prime: 60000 }
];

export function primeMensuelle(beneficeNet) {
  const t = PRIMES_MENSUELLES_TRANCHES.find(t =>
    beneficeNet >= t.beneficeMin && beneficeNet < t.beneficeMax);
  return t ? t.prime : 0;
}

// === Vérification masse salariale — TTE 90% du CA ===
export function checkMasseSalariale(masse, ca) {
  if (ca === 0) return { ok: false, ratio: 0, alerte: false };
  const ratio = masse / ca;
  return {
    ok: ratio <= 0.90,
    ratio,
    alerte: ratio > 0.85
  };
}
