// ============================================================
// Calcul de la paie — au prorata du travail réel
// Réf : prompt projet, conforme TTE Chap. IV — Secteur 2
// ============================================================

import { PLAFOND_SALAIRE, COMMISSION_VENDEUR, CA_PLAFOND_VENDEUR,
         isVendeur, isPompiste, isResponsable, isDirection } from './permissions.js';

/**
 * Salaire vendeur — commission sur bénéfice, plafond CA 40 000 $
 * @param {string} role
 * @param {number} caGenere     Chiffre d'affaires généré par le vendeur
 * @param {number} beneficeTotal  Bénéfice total (vente - achat) sur ses ventes
 */
export function salaireVendeur(role, caGenere, beneficeTotal) {
  if (!isVendeur(role)) return 0;
  const commission = COMMISSION_VENDEUR[role] ?? 0;
  const plafondSalaire = PLAFOND_SALAIRE[role] ?? 0;

  // Le CA au-delà de 40 000 $ ne compte pas — on calcule un bénéfice prorata
  let beneficeRetenu = beneficeTotal;
  if (caGenere > CA_PLAFOND_VENDEUR && caGenere > 0) {
    const ratio = CA_PLAFOND_VENDEUR / caGenere;
    beneficeRetenu = beneficeTotal * ratio;
  }
  const brut = beneficeRetenu * commission;
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
 * Salaire responsable — fixe (saisi manuellement par patron)
 */
export function salaireResponsable(role, salaireDecide) {
  if (!isResponsable(role)) return 0;
  const plafond = PLAFOND_SALAIRE[role] ?? 0;
  return Math.min(Math.round(salaireDecide ?? 0), plafond);
}

/**
 * Salaire direction — fixe au plafond
 */
export function salaireDirection(role, salaireDecide) {
  if (!isDirection(role) && role !== 'drh') return 0;
  const plafond = PLAFOND_SALAIRE[role] ?? 0;
  return Math.min(Math.round(salaireDecide ?? plafond), plafond);
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
    return salaireVendeur(e.role, e.caGenere ?? 0, e.beneficeGenere ?? 0);
  }
  if (isPompiste(e.role)) {
    return salairePompiste(e.role, e.bidonsRealises ?? 0,
                           e.caoutchoucsRealises ?? 0,
                           quotaBidons, quotaCaoutchoucs);
  }
  if (isResponsable(e.role)) {
    return salaireResponsable(e.role, e.salaireDecide ?? 0);
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
