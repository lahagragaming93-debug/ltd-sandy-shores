# 5 — Guide d'utilisation

## Pour le Patron / Co-Patron

### Tableau de bord
Vue centrale : CA, bénéfice net estimé, masse salariale, alertes actives,
top produits, niveaux des stations, historique 6 dernières semaines.

### Stocks épicerie
- Filtres par catégorie, niveau d'alerte, recherche libre
- **Modifier** un produit : prix achat (saisi à la main), prix vente, seuil d'alerte
- **Ajustement manuel du stock** : justification obligatoire (audit)
- Tous les mouvements sont historisés (logs Discord ou ajustement manuel)

### Stations essence
- Vue par station avec niveau visuel
- Configuration : nom, capacité max, seuil d'alerte (en litres), prix au litre
- Liste des redistributions de la semaine
- Stock cumulé et alertes automatiques

### Ventes
- Liste des factures de la semaine en cours (logs `suivi-facture` + ventes
  manuelles déclarées sur le site)
- Colonne **Source** : 🤖 Discord (import auto FiveM) vs 📝 manuelle
  (déclarée sur le site)
- Filtres par vendeur / paiement / texte libre
- Détection automatique des **discordances** (vente sans sortie de stock)
- Bouton **✏ Modifier** sur chaque ligne — réservé aux rôles autorisés
  (voir *Modification d'une vente*)
- Indicateur "✏ modifiée par X" affiché sous la facture après modification
- Export CSV de la semaine

### Modification d'une vente
Rôles autorisés : **patron, co-patron, admin technique, DRH,
responsable-vente**.

1. Page **Ventes** → bouton **✏ Modifier** sur la ligne concernée
2. Le modal s'ouvre **pré-rempli** avec les anciennes valeurs
3. Modifier les lignes / le montant / le client / le paiement
4. Saisir un **motif de modification obligatoire** (audit)
5. Valider → la facture est mise à jour :
   - bénéfice **recalculé serveur** depuis les prix d'achat actuels
   - delta de stock réajusté (transaction atomique)
   - champs `modifiePar`, `modifieParNom`, `motifModification`,
     `dateModification` remplis
   - mouvement `modification-vente` dans `/mouvementsStock` (audit)

L'historique est immuable : on garde le doc `/ventes` initial enrichi de
ses métadonnées de modification (jamais de delete).

### Comptabilité
- Postes hebdomadaires conformes TTE Chap. IV — Secteur 2
- Bouton **+ Ajouter une dépense** (raison + montant + type déductible/non)
- KPI conformité (masse salariale ≤ 90 % CA)
- Sélection d'une semaine archivée pour consultation
- Export CSV / impression PDF

### Ressources humaines
- Vue effectif avec heures, CA généré, score pompiste, salaire estimé
- Détail par employé en cliquant sur **Détail**
- Pour la direction et les responsables : possibilité de **décider** un salaire
  fixe (dans la limite du plafond TTE)

### Administration
- Création de comptes employés (génère email + mot de passe provisoire)
- Modification du rôle, suspension (= licenciement), suppression
- Configuration globale (quotas pompistes **bidons + caoutchoucs**, quota
  CA hebdo vendeur, prix essence)
- Colonne **Averts** : badge cliquable par employé → modal pour créer
  (motif libre) ou retirer un avertissement (voir section *Avertissements*)

## Pour les employés (vendeurs / pompistes)

### Mon espace
- Bouton **📝 Déclarer une vente** en haut de la page (voir section
  *Déclaration de vente* plus bas)
- **Vendeur** : ton CA, ton bénéfice, **KPI quota CA hebdo** (30 000 $ par
  défaut, configurable) avec barre de progression, salaire estimé
- **Pompiste** : bidons réalisés, caoutchoucs réalisés, score, salaire estimé
- **Mes avertissements** : bannière graduée (jaune 1 / orange 2 / rouge 3 =
  compte BLOQUÉ) + liste détaillée (voir section *Avertissements*)
- **Sorties en attente / non régularisées** : bandeau qui s'affiche si tu as
  sorti un produit d'un coffre LTD sans l'avoir vendu ni redéposé (voir
  section *Anti-vol 30 min*)
- Heures de service de la semaine (information uniquement)

### Déclaration de vente
L'employé déclare la vente en saisissant **uniquement les produits + quantités**.
Le **prix de vente** vient du catalogue `/produits`, le **prix d'achat**
aussi, et le **bénéfice** est calculé automatiquement par le serveur.

1. Page **Mon espace** → bouton **📝 Déclarer une vente**
2. Ajouter une ou plusieurs **lignes produit** (menu déroulant par catégorie,
   triées alphabétiquement) avec quantité
3. Le **prix de vente catalogue**, le **coût total** et le **bénéfice** se
   calculent en direct dans le modal
4. **Valider la vente** → la facture est créée dans `/ventes` avec :
   - `factureId` auto au format `M{YYYYMMDD}-{NNNN}` (M = manuelle)
   - `source: 'manuelle'`, `verrouille: true`
   - `client: 'Client comptoir'`, `paiement: 'especes'` par défaut
   - décrément automatique de `/stocks` (transaction atomique)
   - mouvement `vente-manuelle` dans `/mouvementsStock` (audit)

Une fois validée, **l'employé ne peut plus modifier la vente**. Seuls la
direction, le DRH et le responsable vente peuvent (voir section
*Modification d'une vente*).

### Anti-vol 30 min
Quand un employé sort un produit d'un coffre LTD (Discord
`#logs-ig` → `inventory-remove`), un compte à rebours de 30 minutes
démarre. Trois issues possibles :

| Issue | Effet |
|---|---|
| A) L'employé **déclare une vente** incluant ce produit | timer annulé ✅ |
| B) L'employé **redépose** le produit dans le coffre | timer annulé ✅ |
| C) Ni A ni B au bout de 30 min | 🚨 alerte automatique |

En cas d'alerte (C) :
- 📢 **Bandeau rouge** sur le *Mon espace* de l'employé : "Sortie non
  régularisée — régularise immédiatement"
- 📋 1 alerte créée dans `/alertes` (type `sortie-non-regularisee`)
- 🪝 Webhook Discord vers la direction si `config.global.webhookAntiVol`
  est configuré

La direction est **exemptée** de ce système (anti-deadlock). Les sorties
ne sont trackées que pour les coffres LTD reconnus (préfixes `action-27310`
épicerie, `action-27166` matériel, `action-30439` entrepôt).

### Mode pompiste — déclaration manuelle des caoutchoucs
Les caoutchoucs ne sont **plus comptés automatiquement** depuis les logs
Discord. Le pompiste déclare sa production directement sur le site :

1. Page **Stations essence** (visible en mode pompiste)
2. Bouton **« Déclarer des caoutchoucs fabriqués »** en haut
3. Saisir le nombre (max 500/déclaration), preview live, valider
4. Le compteur `/quotasPompiste` est incrémenté en temps réel

Les compteurs sont remis à zéro à la clôture hebdomadaire (voir plus bas).

## Calcul de la paie

Tout est automatique dès que les logs Discord remontent. Le calcul est
**au prorata du travail réel**.

### Vendeur
```
Salaire = MIN(Bénéfice retenu × commission, Plafond)
```
- Si CA généré > 40 000 $, on retient seulement la partie correspondant au plafond
- Plafonds : 13 000 / 14 000 / 15 000 $ (Novice / Intermédiaire / Expérimenté)
- Commissions : 32,5 % / 35 % / 37,5 %

### Pompiste
```
Score bidons     = bidons réalisés / quota (max 100 %)
Score caoutchouc = caoutchoucs réalisés / quota (max 100 %)
Salaire = (Score bidons + Score caoutchouc) / 2 × Plafond
```
- Quotas par défaut : 1 700 bidons + 800 caoutchoucs / semaine (configurables)
- Plafonds : 13 000 / 14 000 / 15 000 $

### Responsable
- Salaire fixe décidé par la direction, plafonné à 17 000 $/sem

### Direction
- Plafond TTE : 20 000 $/sem (Patron, Co-Patron, DRH)

## Conformité TTE — règles automatiques

- **Masse salariale > 90 % CA** : alerte affichée
- **Plafond direction (20 000)** : non dépassable depuis l'interface
- **Plafond employé (19 000)** : aligné sur les rôles
- **Conservation 6 semaines** : la clôture purge les semaines > 6
- **Primes hebdomadaires (Art. 4-1.10)** : selon tranches de CA
- **Primes mensuelles (Art. 4-1.11)** : selon tranches de bénéfice net

## Clôture hebdomadaire (2 étapes)

Automatique en deux temps via Cloud Function (heure Paris) :

### Étape 1 — `clotureHebdo` : lundi 00 h 00 (juste après dimanche 23 h 59)
Clôt les **ventes** de la semaine écoulée. Une entrée apparaît dans
`/semaines` avec CA, bénéfice brut, dépenses non-paies. Statut
`cloturee-partielle` car les paies du dimanche peuvent être versées
jusqu'au mardi 21 h.

**Dans la foulée**, scan auto des quotas (voir *Avertissements → auto*) —
l'avertissement tombe **à la fin de la semaine**, pas après les paies.

### Étape 2 — `clotureHebdoPaies` : mardi 21 h 05
Récupère **toutes les paies effectivement versées** pour la semaine et
finalise le doc `/semaines` (masse salariale réelle, bénéfice net).
Statut `cloturee`.

## Avertissements

Système immuable d'audit RH. Chaque avertissement est conservé même après
retrait (jamais supprimé). Trois actifs simultanés → compte bloqué.

### Côté patron / co-patron / admin technique
- Page **Admin** → colonne **Averts** : badge cliquable par employé
- Modal détail : liste complète (actifs + retirés) + bouton **Créer un
  avertissement** (motif libre) + bouton **Retirer** sur chaque actif
- Les averts auto et manuels sont mélangés (filtrables visuellement)

### Côté employé
- Page **Mon espace** → bloc **Mes avertissements**
- Bannière graduée :
  - 1 actif : 🟡 avertissement
  - 2 actifs : 🟠 attention
  - 3 actifs : 🔴 **COMPTE BLOQUÉ**
- Liste détaillée dessous (motif + date + auto/manuel)
- Mise à jour instantanée quand un avert est créé / retiré

### Blocage effectif (3 avertissements actifs)
- **Refus serveur** sur ravitaillement station + déclaration caoutchoucs
  (Cloud Functions vérifient `caller.avertsActifs < 3`)
- **Règles Firestore** : écritures bloquées sur `/stations`,
  `/redistributions`, `/declarationsCaoutchouc`
- **Bannière rouge** sur toutes les pages côté frontend (boutons grisés)
- **Direction toujours exemptée** (patron, co-patron, admin technique) —
  anti-deadlock si la direction prend 3 averts

### Auto-avertissements (lundi 00 h 00, dès la clôture des ventes)
Scan automatique de tous les employés actifs :

- **Pompiste / responsable pompiste** : si bidons < quota OU caoutchoucs
  < quota → 1 avert auto avec motif détaillé (ex. `Quota hebdo non atteint
  (semaine 2026-05-04) : bidons 1200/1700, caoutchoucs 600/800`)
- **Vendeur** : si CA hebdo < `cfg.quotaCAVendeur` (30 000 $ par défaut) →
  1 avert auto
- **Direction** : jamais ciblée

ID déterministe `auto_{weekKey}_{uid}` → **idempotent** : si la cron
retourne, pas de doublon. Si le patron retire un avert auto, il ne sera
**pas recréé** la fois suivante.

## Alertes

Le bandeau rouge en haut à droite (⚠) indique le nombre d'alertes actives.
Cliquer pour les voir. Types :

- ⚠ Stock bas / 🔴 Rupture
- ⚠ Station essence sous seuil
- 🚨 Vente sans sortie de stock corrélée
- ⚠ Masse salariale > 85 % du CA (avant le seuil critique de 90 %)

## Mise à jour des prix d'achat

Les prix d'achat ne sont pas dans les logs FiveM — ils doivent être saisis
manuellement par le patron :

1. **Stocks épicerie** → cliquer **Modifier** sur la ligne du produit
2. Renseigner **Prix achat** (en $)
3. Enregistrer

Le bénéfice par vente sera désormais calculé automatiquement.
