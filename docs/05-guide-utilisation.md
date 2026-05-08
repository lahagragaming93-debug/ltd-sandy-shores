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
- Liste des factures de la semaine en cours (logs `suivi-facture`)
- Filtres par vendeur / paiement / texte libre
- Détection automatique des **discordances** (vente sans sortie de stock)
- Export CSV de la semaine

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
- Configuration globale (quotas pompistes, prix essence)

## Pour les employés (vendeurs / pompistes)

### Mon espace
- **Vendeur** : ton CA, ton bénéfice, progression vers 40 000 $, salaire estimé
- **Pompiste** : bidons réalisés, caoutchoucs réalisés, score, salaire estimé
- Heures de service de la semaine (information uniquement)

Les compteurs sont remis à zéro chaque dimanche à 00 h 00.

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
- **Conservation 6 semaines** : la clôture du dimanche purge les semaines > 6
- **Primes hebdomadaires (Art. 4-1.10)** : selon tranches de CA
- **Primes mensuelles (Art. 4-1.11)** : selon tranches de bénéfice net

## Clôture hebdomadaire

Automatique le **dimanche à 00 h 00 (heure Paris)** via Cloud Function.

Une nouvelle entrée apparaît dans `/semaines` avec :
- CA, bénéfice brut, dépenses, masse salariale, bénéfice net
- Statut `cloturee`
- Toutes les données restent consultables ensuite

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
