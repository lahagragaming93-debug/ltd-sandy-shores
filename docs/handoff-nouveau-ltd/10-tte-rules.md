# 10 — Règles TTE Sandy Shores implémentées

> Référence intégrale dans `docs/TTE-complet.txt` et `public/guide/10-tte-reference.md` (12 chapitres consolidés).
> Ce document liste **uniquement les règles concrètement implémentées dans le code** + où elles sont câblées.

---

## 🏛 Classification du LTD

**LTD = Secteur 2** (Services et biens indispensables — TTE Art. 4-1.9.1, confirmé IRS).

→ Toutes les règles ci-dessous s'appliquent au **Secteur 2** par défaut. Si tu adaptes le squelette à un Secteur 1 (luxe) ou Secteur 3 (B2B), revoir les plafonds + tranches.

---

## 💰 Plafonds salariaux (Art. 4-1.2 à 4-1.4)

| Catégorie | Plafond hebdo |
|---|---|
| Employés (vendeurs, pompistes, responsables) | **19 000 $** |
| Direction (patron, co-patron) | **20 000 $** |
| DRH | **20 000 $** (assimilé direction RH) |

**Code** : `public/js/utils/permissions.js`
```js
export const PLAFOND_SALAIRE = {
  'patron': 20000,
  'co-patron': 20000,
  'drh': 20000,
  'responsable-vente': 19000,
  'responsable-pompiste': 19000,
  'vendeur-novice': 19000,
  'vendeur-intermediaire': 19000,
  'vendeur-experimente': 19000,
  'pompiste-novice': 19000,
  'pompiste-intermediaire': 19000,
  'pompiste-experimente': 19000,
  'admin-technique': 0   // pas RP, pas payé
};
```

**Affiché sur** : `/rh` (KPI "Salaire estimé" vs "Plafond TTE"), `/employee` (panel "Détail")

---

## 📊 Masse salariale ≤ 90 % du CA (Art. 4-1.5)

**Règle** : la somme des salaires versés ne peut excéder 90 % du chiffre d'affaires de la semaine.

**Code** : `public/js/utils/paie.js` — `checkMasseSalariale(masse, ca)`
```js
export function checkMasseSalariale(masse, ca) {
  if (ca === 0) return { ok: false, ratio: 0, label: 'CA nul' };
  const ratio = masse / ca;
  if (ratio > 0.90) return { ok: false, ratio, label: '🔴 HORS TTE' };
  if (ratio > 0.85) return { ok: true, ratio, label: '🟠 LIMITE' };
  return { ok: true, ratio, label: '🟢 OK' };
}
```

**Affiché sur** :
- `/rh` (KPI "Masse salariale" en %)
- `/comptabilite` (alerte rouge si dépassement)
- Dashboard Sheet (KPI "Masse salariale" + indicateur Conformité TTE)

**Action si dépassé** : warning UI + alerte dans `/alertes`. Le code n'empêche pas la clôture (à la discrétion du patron).

---

## 🎁 Primes hebdomadaires (Art. 4-1.10)

**Règle** : prime pour la direction selon tranches CA hebdo.

| CA hebdo | Prime potentielle |
|---|---|
| < 200 000 $ | 0 $ |
| 200 000 - 399 999 $ | 5 000 $ |
| 400 000 - 599 999 $ | 10 000 $ |
| ≥ 600 000 $ | 15 000 $ |

**Code** : `firebase/functions/index.js`
```js
function primeHebdoFromCa(ca) {
  if (ca >= 600000) return 15000;
  if (ca >= 400000) return 10000;
  if (ca >= 200000) return 5000;
  return 0;
}
```

**Affiché sur** :
- Dashboard Sheet (colonne "Prime hebdo (potentielle)" dans HISTORIQUE)
- Onglet snapshot `Semaine N` (info KPI)

⚠ "Potentielle" : le code n'oblige pas à la verser, c'est juste éligible. Le patron décide.

---

## 🎁 Primes mensuelles (Art. 4-1.11)

**Règle** : prime pour la direction selon tranches bénéfice net mensuel.

| Bénéfice net mensuel | Prime potentielle |
|---|---|
| < 500 000 $ | 0 $ |
| 500k - 999 999 $ | 20 000 $ |
| 1M - 1 999 999 $ | 40 000 $ |
| ≥ 2M $ | 60 000 $ |

**Code** : `firebase/functions/index.js`
```js
function primeMensuelleFromBenefice(b) {
  if (b >= 2000000) return 60000;
  if (b >= 1000000) return 40000;
  if (b >=  500000) return 20000;
  return 0;
}
```

⚠ Actuellement calculé sur le **bénéfice net hebdo** dans le code (pas mensuel). À corriger si tu veux du calcul mensuel strict.

---

## 💵 Commission vendeur (calcul interne, conforme TTE Art. 4-1.7)

**Règle** : le salaire vendeur = `CA particulier × commission` selon grade.

| Grade vendeur | Commission |
|---|---|
| vendeur-novice | 13 % (calibré pour atteindre 13k$ à 100k$ CA) |
| vendeur-intermediaire | 14 % (calibré pour atteindre 14k$ à 100k$ CA) |
| vendeur-experimente | 15 % (calibré pour atteindre 15k$ à 100k$ CA) |

**Code** : `public/js/utils/paie.js`
```js
export const COMMISSION_VENDEUR = {
  'vendeur-novice':        0.13,
  'vendeur-intermediaire': 0.14,
  'vendeur-experimente':   0.15
};

export const CA_PLAFOND_VENDEUR = {
  'vendeur-novice':        100000,    // CA max retenu pour commission
  'vendeur-intermediaire': 100000,
  'vendeur-experimente':   100000
};

export function salaireVendeur(role, caParticulier) {
  const taux = COMMISSION_VENDEUR[role] || 0;
  const plafondCA = CA_PLAFOND_VENDEUR[role] || Infinity;
  const caRetenu = Math.min(caParticulier, plafondCA);
  return Math.round(caRetenu * taux);
}
```

⚠ La commission **ne s'applique QU'AU CA particulier** (produits avec `pourPro: false`). Les ventes professionnelles ne génèrent pas de commission (`feedback_salaire_vendeur_sur_ca` mémoire).

**Dupliqué backend** : `firebase/functions/lib/paie-calc.mjs` (à maintenir en miroir).

---

## ⛽ Salaire pompiste (calcul interne)

**Règle** : fixe selon grade + bonus si quotas hebdo atteints.

| Grade pompiste | Salaire fixe | Quotas hebdo |
|---|---|---|
| pompiste-novice | 12 000 $ | 1 700 bidons + 800 caoutchoucs |
| pompiste-intermediaire | 14 000 $ | 2 200 bidons + 1 000 caoutchoucs |
| pompiste-experimente | 16 000 $ | 2 700 bidons + 1 200 caoutchoucs |

**Code** : `public/js/utils/paie.js` (à vérifier exactement selon évolution)

**Score pompiste** = % atteinte quota bidons + % atteinte quota caoutchoucs / 2

---

## 🧾 Déductibilité (Art. 4-1.4 + Art. 4-2.9)

**Règles confirmées par patron + IRS** :

### Déductible d'office (sans accord IRS)
- **Avocat** (max 30 000 $ / mois) — Art. 4-2.X
- **Comptable** (max 8 000 $ / mois)
- **Nourriture employés** (750 $ / employé / mois)
- **Matières premières** revente clients (Yootool boutique 263, Fournisseur LTD 215, etc.)
- **Entretien véhicules entreprise** (carte essence pro)

### Non déductible (sauf accord IRS spécifique)
- **Véhicules entreprise** (achat / location) — sauf accord
- **Immobilier** — sauf accord
- **Décoration locaux** (Dynasty 8, etc.)
- **Loyer Sandy Shores LTD** (compte cible loyer auto)

### Décision patron OBLIGATOIRE
- **JAMAIS d'auto-classification** dans le code. Le mapping fournisseurs SUGGÈRE, le patron valide.
- Mémoire : `feedback_tte_decision_patron` — "Art. 2-4.3/2-4.4 pas à implémenter pour le moment"

**Code** :
- Mapping `/config/global.fournisseurs` (CRUD via `/admin`)
- Auto-suggestion par bot Discord (`parsers/depense.js`)
- Bouton 🔄 Reclasser sur `/comptabilite` (modal patron)
- Cloud Function `reclasserDepense`

---

## 📅 Workflow fiscal hebdomadaire (Art. 4-3)

| Jour / heure | Action | Responsable |
|---|---|---|
| Dimanche 23h59 | Fin semaine RP | — |
| **Lundi 00h00** | Cron `clotureHebdo` étape 1 fige CA + dépenses | Auto |
| **Lundi 00h-01h** | Patron ferme IG, verse les paies en jeu, clique 🔒 | Patron |
| **Mardi 21h max (Art. 4-3.3)** | Déclaration fiscale sur site IRS | Patron |
| **Mardi 21h05** | Cron `clotureHebdoPaies` étape 2 (filet sécurité) | Auto |
| **Mercredi 21h max (Art. 4-3.4)** | Paiement des impôts | Patron |

**Sanctions retard déclaration** : +10 % par 24h.

---

## 🏛 Tranches d'imposition (Art. 4-3.2)

| Bénéfice net hebdo | Taux | Tranche |
|---|---|---|
| ≤ 10 000 $ | 0 % | Tranche 0 (exonéré) |
| 10 001 - 50 000 $ | 10 % | Tranche 1 |
| 50 001 - 100 000 $ | 19 % | Tranche 2 |
| 100 001 - 250 000 $ | 28 % | Tranche 3 |
| 250 001 - 500 000 $ | 36 % | Tranche 4 |
| ≥ 500 001 $ | 46 % | Tranche 5 |

**Code** : `firebase/functions/lib/dashboard-core.mjs` — `tranchesImpot(benefice)`
```js
function tranchesImpot(benefice) {
  if (benefice <= 10000)  return { tranche: 0, taux: 0,    montant: 0 };
  if (benefice <= 50000)  return { tranche: 1, taux: 0.10, montant: Math.round(benefice * 0.10) };
  if (benefice <= 100000) return { tranche: 2, taux: 0.19, montant: Math.round(benefice * 0.19) };
  if (benefice <= 250000) return { tranche: 3, taux: 0.28, montant: Math.round(benefice * 0.28) };
  if (benefice <= 500000) return { tranche: 4, taux: 0.36, montant: Math.round(benefice * 0.36) };
  return { tranche: 5, taux: 0.46, montant: Math.round(benefice * 0.46) };
}
```

**Affiché sur** : Dashboard Sheet (KPI "IMPÔT ESTIMÉ" + détail tranche).

---

## 🚨 Sanctions IRS (Art. 4-3.5)

| Palier | Conditions | Sanctions |
|---|---|---|
| Palier 1 | 1ère infraction | Amende 5 % du compte LTD |
| Palier 2 | 2e infraction | Amende 7 % + suspension d'activité 24h |
| Palier 3 | 3e infraction | Amende 10 % + suspension 72h |
| Palier 4 | Récidive | Retrait licence LTD (mort RP de l'entreprise) |

**Code** : non implémenté côté code (l'IRS RP applique manuellement). Le code expose juste les indicateurs de conformité sur Dashboard pour anticiper.

---

## 🆘 Cessation de paiement (Art. 4-X)

**Règle** : si bénéfice net < 0 sur **4 semaines consécutives**, déclaration de cessation de paiement obligatoire.

**Affiché sur** : pas implémenté dans le code (à monitorer manuellement via le HISTORIQUE des semaines). Le KPI "BÉNÉFICE NET CUMULÉ depuis reprise" donne un indicateur global mais ne flag pas le seuil 4 semaines.

**TODO si évolution** : ajouter une alerte automatique si `semaines[-4..-1].every(s => s.beneficeNet < 0)`.

---

## 🎁 Subventions IRS (Art. 4-2.16)

**Règle** : les subventions reçues sont **non imposables** mais remboursables selon contrat.

**Code** :
- Tagging entrée banque comme `categorieEntree: 'subvention'` via `/admin` (mémoire `marquer-subvention`)
- Affichage Dashboard Sheet sous "🏛 SUBVENTIONS REÇUES" (non incluses dans calcul impôt)
- Engagement de remboursement créé en parallèle dans `/engagements` (visible "📋 ENGAGEMENTS DE REMBOURSEMENT")

**Exemple Sandy Shores** : subvention essence 790 000 $ Abraham THORPE 14/05/2026, dette 300 000 $ à rembourser sous 4 semaines (échéance ~11/06).

---

## 🔢 Calculs croisés implémentés

### Bénéfice brut
```
beneficeBrut = caTotal - coûtAchatProduitsVendus
```

### Bénéfice net (= "vrai bénéfice empoché" affiché Dashboard)
```
beneficeNet = caTotal - depensesTotales - masseSalariale
```

⚠ Ne prend PAS en compte l'impôt estimé. Le "bénéfice après impôt" serait `beneficeNet - tranchesImpot(beneficeNet).montant`.

### Résultat imposable (= base impôt TTE Art. 4-2.4)
```
resultatImposable = (caTotal + autresRevenus) - chargesDeductibles
```

⚠ Les subventions ne sont PAS dans `autresRevenus` (non imposables Art. 4-2.16).

---

## 🔄 Si tu adaptes à un autre serveur RP

Si le serveur cible a son propre TTE (différent de Sandy Shores) :

1. **Récupérer le doc TTE officiel** du serveur → `docs/TTE-complet.txt` (à remplacer)
2. **Mettre à jour `public/guide/10-tte-reference.md`** avec les nouveaux articles
3. **Modifier les plafonds** dans `public/js/utils/permissions.js` + `firebase/functions/lib/paie-calc.mjs`
4. **Modifier les tranches primes** dans `firebase/functions/index.js` (`primeHebdoFromCa`, `primeMensuelleFromBenefice`)
5. **Modifier les tranches impôt** dans `firebase/functions/lib/dashboard-core.mjs` (`tranchesImpot`)
6. **Modifier le mapping déductibilité** dans `firebase/functions/scripts/init-fournisseurs-mapping.js`
7. **Ajuster les jours/heures du workflow** dans les schedules `clotureHebdo` (cron syntax) + ajuster les heures affichées dans le guide

Test : faire une semaine complète en mode test (créer des ventes fake, attendre la clôture cron, vérifier les calculs).
