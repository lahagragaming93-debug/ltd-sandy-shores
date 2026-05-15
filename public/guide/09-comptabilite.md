# 📋 Comptabilité — Guide complet

> Tout ce qu'il faut savoir pour tenir la compta du LTD Sandy Shores au propre, conforme **TTE Chap. IV — Secteur 2**, et prête pour un contrôle **IRS RP** à tout moment.

La compta du LTD vit à 2 endroits :
- 🌐 **Le site** (page Comptabilité) → vue temps réel + saisies manuelles
- 📊 **Le Google Sheet** → archive lecture seule, prête pour audit IRS

---

## 🔐 1. Qui a accès à quoi ?

| Rôle RP | Accès Sheet compta | Accès page site Comptabilité | Peut faire quoi |
|---------|---------------------|-------------------------------|------------------|
| 👑 **Blake MARS** (Patron) | ✅ Écriture complète | ✅ Lecture + écriture | Tout : ajouter dépenses, décider salaires, cloturer, partager le Sheet |
| 🛠 **Andrew BEAUCHAMP** (Admin Technique) | ✅ Écriture complète | ✅ Lecture + écriture | Tout (rôle de support technique pendant la passation) |
| 🛒⛽ **Gérants de station / Responsables** | 👀 Lecture seule **sur demande** | ✅ Lecture (pas modifier) | Consulter la compta, voir leur secteur, demander un export |
| 👷 **Employés** (vendeurs / pompistes) | ❌ Aucun accès direct | ❌ Aucun accès | Saisissent indirectement via le **site** ou le **bot Discord** (factures, services) |
| 🔎 **Contrôleur IRS RP** | 👀 Lecture seule **ponctuelle** (lien partagé) | ❌ N'a pas de compte sur le site | Ouvre le Sheet le temps du contrôle, voit tout l'historique + détail |

> 🔑 **Règle d'or** : seuls Blake MARS et Andrew BEAUCHAMP peuvent **écrire** dans le Sheet ou la page Comptabilité. Tout le reste passe par le site (qui filtre les permissions) ou par les logs Discord (qui sont automatiques).

---

## ✏ 2. Comment saisir une vente, une dépense, une paie

### 💵 Une vente (facture)

**95 % des cas → automatique via le bot Discord**

Le vendeur fait une facture in-game (`/facture` ou ouverture du menu de facturation FiveM). FiveM poste un embed dans le canal Discord `#suivi-facture`. Le bot LTD parse → ça apparaît instantanément dans :
- **Site** → page **Ventes**
- **Sheet** → onglet **Ventes**

Tu n'as rien à faire — sauf si tu vois une **discordance** (vente sans sortie de stock corrélée), à investiguer.

> 📖 Détail technique : voir [07-automatismes.md](07-automatismes.md)

---

### ❤ Une dépense

**2 cas possibles** :

#### Cas 1 : Dépense passée par le compte bancaire LTD (in-game)
→ **Automatique** via le bot Discord canal `#depenses`. FiveM logue toute sortie d'argent du compte LTD, le bot enregistre dans la base. Apparaît dans **Comptabilité → Charges détaillées**.

#### Cas 2 : Dépense cash hors compte (rare)
→ **Saisie manuelle** sur le site :
1. Va sur la page **Comptabilité**
2. Clique sur l'un des **5 templates rapides** en haut (🏭 Matières premières / ⚖ Frais avocat / 🚗 Entretien véhicule / 💰 Loyer / 📦 Autre) — la modale s'ouvre avec raison + type pré-remplis
3. Saisis le **montant** uniquement
4. Clique **« Enregistrer la dépense »**

Apparaît immédiatement dans le Sheet aussi (avec le nom de qui a saisi, traçable).

> ⚠ Choisis le bon **type** : `matieres-premieres`, `frais-avocat`, `entretien-vehicules` sont **déductibles fiscalement**. `non-deductible` ne l'est pas. Le type bouge la colonne « Charges déductibles » dans le Sheet → impact direct sur le résultat imposable.

---

### 💰 Une paie (salaire versé)

**Toujours via Discord** — le site **n'a pas** de bouton « verser un salaire ». La paie est une opération RP qui se fait in-game.

**Workflow recommandé** (10 min, à faire le **dimanche soir**) :

1. Va sur le site → **Comptabilité** → bas de page → section **« 💰 Salaires & paies »**
2. Vérifie la colonne **« Reste à verser »** par employé (Direction, Responsables)
3. Bouton **« 📋 Copier récap Discord »** en haut à droite de la section
4. Le presse-papiers contient un message formaté du genre :
   ```
   📋 RÉCAP SALAIRES — semaine 09/05/2026 au 15/05/2026
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   👑 DIRECTION
   • Blake MARS — 20 000 $ à verser
   ...
   TOTAL Direction + Responsables : 35 000 $
   ```
5. Colle dans le canal Discord `#paie`
6. **Verse** chaque montant via la commande de paie in-game (`/payer`, virement bancaire FiveM, etc.) — c'est ça l'acte RP qui fait sortir l'argent du compte LTD
7. Le bot Discord enregistre chaque paie → la colonne **« Versé cette semaine »** se remplit en temps réel sur le site
8. Quand tous sont à **✓ Versé** → tu es OK pour la clôture automatique de lundi 00h

> 💡 Pour les **vendeurs et pompistes**, leurs salaires sont **calculés automatiquement** selon leur CA / quotas. Ouvre **Ressources humaines** sur le site → bouton **« Détail »** sur chacun pour voir le montant à verser.

---

## 📅 3. Comment clôturer une semaine

### Bonne nouvelle : c'est automatique

Tous les **lundis à 00:00 (heure Paris)**, la Cloud Function `clotureHebdo` se déclenche **toute seule** et :
- Agrège la semaine qui vient de finir (lundi précédent 00h → dimanche 23h59)
- Crée une nouvelle ligne dans l'onglet **Resume** du Sheet (et `/semaines/{date}` côté serveur)
- Calcule : CA, dépenses, masse salariale, primes (Art. 4-1.10 + Art. 4-1.11), bénéfice net, statut `cloturee`
- La nouvelle semaine démarre avec compteurs à 0

**Tu n'as rien à faire activement le lundi.** Le système fait son boulot pendant que tu dors.

### Ce que TOI tu fais avant lundi 00h00 (dimanche soir)

1. **Vérifie la gauge masse salariale** dans Comptabilité — doit être verte (< 85 %) idéalement
2. **Verse tous les salaires** restants (cf. section 2 ci-dessus)
3. **Note les éventuelles anomalies** : discordances dans Ventes, dépenses douteuses, etc.

### Quelles colonnes regarder dans l'onglet `Resume` du Sheet

Quand tu ouvres l'onglet `Resume` (ou via le Dashboard → Historique des semaines), chaque ligne représente **une semaine clôturée** avec :

| Colonne | Source | À quoi ça sert |
|---------|--------|-----------------|
| **Semaine** | Auto (date du lundi de début) | Identifiant unique de la semaine |
| **Date début** | Auto | Lundi 00h00 |
| **Date fin** | Auto | Dimanche 23h59 |
| **CA** | Somme des ventes | Recettes brutes |
| **Bénéfice brut** | Somme des bénéfices ventes | CA − coût d'achat des produits vendus |
| **Dépenses totales** | Somme des dépenses | Tout ce qui sort (déductible + non) |
| **Charges déductibles** | Filtre sur `deductible !== false` | Réduit le résultat imposable |
| **Masse salariale** | Somme des paies versées | Salaires effectivement versés (pas estimés) |
| **Prime hebdo (Art. 4-1.10)** | Calculée selon tranches CA | 0 / 5k / 10k / 15k |
| **Prime mensuelle (Art. 4-1.11)** | Calculée selon tranches bénéfice net | 0 / 20k / 40k / 60k |
| **Bénéfice net** | CA − dépenses totales − masse salariale | Ce qui reste vraiment |
| **Nb ventes** | Compteur | Pour stat |
| **Nb dépenses** | Compteur | Pour stat |
| **Statut** | Auto | `cloturee` quand validé |

> ⚠ Une fois une semaine clôturée, **tu ne dois pas la modifier** dans le Sheet. C'est figé pour audit. Si une erreur s'est glissée, contacte la direction technique pour passer par la console Firebase (modification tracée).

---

## 📊 4. Comment lire le Dashboard

Le Dashboard est l'**onglet 📊** en première position du Sheet. C'est **la vue qu'on partage au contrôleur IRS**.

### 📈 Les 4 KPIs en haut (semaine en cours)

| KPI | Couleur | Ce qu'il représente |
|-----|---------|---------------------|
| **📈 CA SEMAINE** | Vert | Somme des ventes de la semaine en cours (mise à jour en continu) |
| **💸 DÉPENSES** | Rouge | Toutes les dépenses de la semaine (déductibles + non déductibles + saisies manuelles + auto Discord) |
| **💰 MASSE SALARIALE** | Orange | Salaires versés (depuis `#paie` Discord). Doit rester ≤ 90 % du CA pour respecter le TTE |
| **🎯 BÉNÉFICE NET** | Bleu (positif) ou Rouge (perte) | CA − dépenses − masse salariale. Le vrai résultat de la semaine. |

### 🕐 Les 5 dernières opérations (juste en dessous)
- 5 dernières ventes (date / vendeur / montant)
- 5 dernières dépenses (date / raison / montant)

Pour avoir l'historique complet → onglets `Ventes` et `Depenses`.

### 📋 Historique des semaines (audit IRS)

Tableau central pour le contrôle. Une ligne par semaine clôturée avec :
- Semaine + date début / fin
- CA / Dépenses / Masse salariale
- **Primes (TTE)** → somme des primes Art. 4-1.10 hebdo + Art. 4-1.11 mensuelle
- **Bénéfice net** (en gras)

En bas, ligne **TOTAL CUMULÉ** sur fond doré : la **somme sur toute la période** (jusqu'à 52 semaines = 1 an). C'est ce que l'IRS regarde pour vérifier la cohérence globale.

### 🔎 Section « Audit IRS — Où trouver le détail »

Panneau noir en bas qui pointe vers les 4 onglets de détail :
- **📁 Depenses** → tous les justificatifs (date / raison / montant / type / déductible / utilisateur qui a saisi)
- **📁 Ventes** → toutes les recettes (date / facture / vendeur / client / montant / paiement)
- **📁 Paies** → tous les salaires versés (date / payeur / bénéficiaire / montant / période)
- **📁 Resume** → récap par semaine (toutes les colonnes ci-dessus)

> 💡 Le Dashboard **ET** les 4 feuilles data (`Depenses`, `Ventes`, `Paies`, `resumé`) sont rafraîchis quand tu cliques **🔄 Rafraîchir doc comptabilité** en haut de la page Comptabilité (cf. §6). Le menu Apps Script `🤠 LTD` n'est plus utilisé.

---

## 🏷 5. Auto-classification des dépenses (déductibilité)

Depuis le 14/05/2026, la page Comptabilité utilise un **mapping fournisseurs** qui suggère automatiquement la catégorie et la déductibilité de chaque dépense entrante. Le patron reste **décisionnaire final** (cf. TTE Art. 4-1.4 : seuls avocats, matières premières et entretien véhicules sont déductibles d'office — tout le reste demande validation).

### Comment ça marche

1. **Le bot capte une dépense** (canal `#depenses` ou xbankaccount removemoney)
2. Le handler `onDepense` lit `/config/global.fournisseurs` (mapping géré en Admin)
3. Si la dépense match un pattern → **catégorie + déductibilité suggérées** sont enregistrées
4. La dépense apparaît dans la table avec un badge :
   - **🔒 Validé** (vert) = le patron a déjà validé
   - **💡** (gris) = suggestion auto, pas encore validée
   - **⚠ À classifier** (orange) = aucun pattern n'a matché → décision patron requise
5. Clic sur **🔄** ouvre la modale qui permet de valider/changer + optionnellement **mémoriser un nouveau pattern**

### Patterns initiaux

| Match | Fournisseur | Catégorie | Déductible |
|---|---|---|---|
| Boutique N°263 | Yootool | matières premières | ✅ oui |
| Boutique N°215 | Fournisseur LTD | matières premières | ✅ oui |
| Compte cible HDM | HDM (Heavy Duty Motors) | location véhicule | ✅ oui |
| Compte cible Dynasty 8 | Dynasty 8 | décoration locaux | ❌ non |
| Raison "achat essence" | Carte entreprise | frais véhicule | ✅ oui (carte pro) |

### Gérer le mapping (page Admin)

Dans **Administration** (direction uniquement), le panneau **🏷 Mapping fournisseurs** liste tous les patterns. Tu peux :
- ➕ Ajouter un nouveau pattern (label + type match + valeur + catégorie + dédu)
- ✏ Modifier un pattern existant
- 🗑 Supprimer un pattern (les dépenses passées déjà classées ne sont pas affectées)

### Workflow recommandé

1. **Une fois par semaine** (avant déclaration fiscale mardi 21h), va dans Comptabilité
2. Trie le tableau **Charges détaillées** par statut (les ⚠ remontent en premier visuellement)
3. Clique **🔄** sur chaque ligne ⚠ → valide la catégorie + dédu + coche "Mémoriser ce fournisseur" si c'est un fournisseur récurrent → la prochaine fois sera auto-classée
4. Les KPIs **Charges déductibles** et **Bénéfice net** se mettent à jour en temps réel

### Cas de figures

- **"Achat boutique N°XXX" non identifié** → ouvre 🔄, regarde quel fournisseur c'est IG, classe + mémorise avec matchType=`boutique-id` et matchValue=`XXX`
- **"Paiement facture N°XXXXXXX"** → le compte cible est auto-identifié via cross-référence avec `/banqueLtd` (xbankaccount removemoney, champ `toPropername`). La modale pré-remplit `matchType=compte-cible` avec le nom du destinataire — coche "Mémoriser" pour que **toutes les futures factures vers ce destinataire** soient auto-classées (ex : toutes les factures vers HDM sont déductibles, toutes vers Dynasty 8 non).
- **"Achat essence"** → auto-classé en frais véhicule (dédu) car carte entreprise = présomption usage pro (Art. 4-2.12)
- **Don versé/reçu** (Art. 3-1.x) → catégorie dédiée à choisir manuellement ; cap 20% déductible si > 50k

### Traçabilité IRS

Chaque dépense validée stocke :
- `validePar` (uid du patron qui a validé)
- `dateValidation` (timestamp)
- `raisonClassification` (justification texte, audit)
- `noteAudit` (note interne optionnelle)
- `fournisseurLabel` (nom du destinataire identifié)

Toutes ces colonnes sont exportées dans le CSV Google Sheets pour les contrôleurs IRS.

---

## 🔒 6. Doc comptabilité Google Sheet — bouton Rafraîchir + Clôture semaine

Le doc compta est **généré côté serveur Node.js** (visuel pro pour le Dashboard, CSV vivant pour les 4 feuilles data). 2 boutons en haut de la page Comptabilité (direction uniquement) :

### 🔄 Bouton Rafraîchir doc comptabilité

Un seul clic met à jour **tout le doc compta** :
1. Régénère l'onglet **📊 Dashboard** depuis Firestore (CA, charges, masse salariale, bénéfice, impôt, subventions, trésorerie, engagements)
2. Casse le cache **IMPORTDATA** des 4 feuilles data (`resumé`, `Depenses`, `Ventes`, `Paies`) en ajoutant `&_t={timestamp}` aux URLs → Sheets re-fetch immédiatement depuis `comptaExport` qui lit Firestore en direct

→ Utilise à chaque fois que tu fais une modif côté site (reclassement, validation patron, ajout de pattern fournisseur) et que tu veux que ça remonte dans le doc compta **maintenant** (sans attendre le cache IMPORTDATA d'~1h).

Latence : ~5-10 sec + toast de confirmation.

### 🎨 Habillage automatique des 4 feuilles data

Le script `format-sheet.js` applique un habillage cohérent sur `Depenses` / `Ventes` / `Paies` / `resumé` :
- **Header** ligne 1 : fond rouge sang LTD + texte blanc bold + figé au scroll
- **Bordures** : grille fine grise + cadre extérieur foncé
- **Auto-resize** colonnes ET lignes selon contenu (texte wrappé visible entièrement)
- **Format `25 000 $`** sur la colonne Montant (aligné à droite)
- **Format date** `dd/MM/yyyy HH:mm:ss` sur la colonne Date → tri et filtres date intelligents
- **Couleurs conditionnelles sur `Depenses`** :
  - 🟢 **vert pâle** si Déductible = oui
  - 🔴 **rouge pâle** si Déductible = non
- **Zebra ivoire/blanc** sur `Ventes`, `Paies`, `resumé` (alternance ligne par ligne pour lisibilité)

Le script est idempotent → relançable à volonté via `node scripts/format-sheet.js` depuis `firebase/functions`.

### 🔒 Bouton Clôturer la semaine

**Disponible uniquement après dimanche 23h59** (la semaine doit être terminée).

Workflow :
1. **D'abord** : tu fais ta déclaration fiscale sur le site IRS (externe au LTD)
2. **Ensuite** : reviens ici, clique 🔒 → modale s'ouvre
3. **Coche** : ✅ "J'ai soumis ma déclaration fiscale sur le site IRS"
4. Optionnel : note de clôture (ex: "Semaine standard, RAS")
5. Clique **🔒 Clôturer définitivement**

→ Le serveur fige les chiffres de la semaine écoulée dans `/semaines/{date-lundi}` avec :
- CA, dépenses, charges déductibles, masse salariale, bénéfice net
- `statut: 'cloturee-manuelle'`
- `confirmationIRS: true`
- `cloturePar` (ton uid + nom)
- `dateClotureManuelle` (timestamp)
- `noteCloture` (si renseignée)

Le Dashboard se rafraîchit automatiquement après clôture.

### Sécurité (Art. 4-1.2)

Le serveur re-vérifie côté Cloud Function :
- Tu es bien direction (patron / co-patron / admin technique)
- On est bien après dimanche 23h59 de la semaine à clôturer
- `confirmationIRS === true` dans le payload

Donc impossible de bidouiller le front pour clôturer avant ou sans confirmation IRS.

---

## 📋 7. Engagements de remboursement (dettes, subventions)

Depuis 2026-05-15, le LTD a une collection `/engagements` qui suit toutes les dettes à rembourser : subventions remboursables, dettes fournisseurs, contrats leasing, etc.

### Ce que tu vois sur le Dashboard du Sheet

Section **📋 ENGAGEMENTS DE REMBOURSEMENT** avec tableau :
- Bénéficiaire (ex : Governor of San Andreas)
- Objet (ex : Subvention Essence à rembourser)
- Montant initial / Remboursé / Restant
- Échéance + jours restants (dynamique)
- Statut couleur : 🟢 OK / 🟠 ÉCHÉANCE PROCHE (≤ 7j) / 🔴 EN RETARD

### Gérer depuis la page Admin

Section **📋 Engagements de remboursement** :
- ➕ **Ajouter** un engagement (modale avec bénéficiaire, signataire, objet, type, montant, dates, notes)
- ✏ **Éditer** (modifier montant remboursé, statut, dates, notes)
- 🗑 **Supprimer** (confirmation critique)
- 💰 **Ajouter un remboursement manuel** (pour les régularisations exceptionnelles)
- 📜 **Historique** des remboursements visible automatiquement dans la modale

### Auto-détection remboursement

Quand une dépense Discord arrive avec une raison contenant `remboursement` + un de ces mots-clés :
- `subvention` / `engagement` / `essence` / `dette` / `gouvernement` / `irs`

→ Le système **décrémente automatiquement** le `montantRestant` de l'engagement correspondant. Pas besoin d'aller dans Admin.

### Alertes automatiques

Cron quotidien à **9h heure Paris** (`cronAlertesEngagements`) :
- **7 jours avant échéance** → alerte orange dans la cloche 🔔 + page Admin
- **Le jour J et après** → alerte rouge critique + statut bascule en `defaillant`

---

## 🔗 8. Comment partager au contrôleur IRS

### Procédure (1 min)

1. Ouvre ton Sheet : https://docs.google.com/spreadsheets/d/1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY/edit
2. Bouton **« Partager »** en haut à droite (icône clé / personne)
3. Choix **« Toute personne avec le lien »** → mode **« Lecteur »** (lecture seule — il ne peut **rien modifier**)
4. Clique **« Copier le lien »**
5. Colle le lien dans le DM Discord du contrôleur (ou son canal de contrôle)

### Ce que voit le contrôleur

- ✅ Toutes les pages du Sheet (Dashboard / Resume / Depenses / Ventes / Paies)
- ✅ Historique complet, totaux cumulés, primes
- ✅ Tous les justificatifs détaillés
- ❌ Il ne peut **pas** modifier
- ❌ Il ne peut **pas** voir qui a accès au site ni les autres comptes
- ❌ Il ne peut **pas** accéder au token compta export ni à la console Firebase

### Après le contrôle

**Pense à révoquer l'accès** :
1. Bouton **« Partager »** à nouveau
2. Repasse sur **« Restreint »** (au lieu de « Toute personne avec le lien »)
3. Le lien cesse de fonctionner pour tous les anciens visiteurs

> 🔐 **Conseil** : si tu veux laisser un accès permanent à un membre du staff serveur (pour audits récurrents), ajoute son email Google directement comme « Lecteur » plutôt que de partager le lien public.

---

## 🚨 Erreurs à NE JAMAIS commettre

1. ❌ **Modifier une semaine clôturée** dans le Sheet → casse l'audit, l'IRS verra l'incohérence
2. ❌ **Partager le Sheet en mode Éditeur** au contrôleur → il pourrait modifier les chiffres
3. ❌ **Diffuser le token compta export** (`eddd7ef…`) → quiconque l'a peut télécharger toutes les données. À garder secret comme un mot de passe
4. ❌ **Classer une dépense en `matieres-premieres` si ce n'est pas le cas** → fraude fiscale RP, sanctions
5. ❌ **Verser les salaires APRÈS lundi 00h** → ils compteront sur la semaine suivante, pas celle qui vient de finir → masse salariale archivée artificiellement basse

---

## 📞 En cas de souci

| Symptôme | Que faire |
|----------|-----------|
| Sheet ne se met pas à jour | Sheet → menu **🤠 LTD** → **🎨 Reformater tout** ; sinon vérifier la formule `=IMPORTDATA(...)` en A1 de chaque onglet |
| Bénéfice net négatif sur une semaine | Vérifie l'onglet `Depenses` pour identifier la dépense anormale, puis croise avec Discord `#depenses` |
| Une paie manque dans `Paies` | Vérifie que le bot Discord est en ligne (Railway), et que le bénéficiaire a bien son **ID Perso** renseigné dans son profil |
| Le contrôleur dit que les chiffres sont faux | Croise avec les exports CSV depuis la page Ventes / Comptabilité du site, et avec les logs bruts Discord (`#suivi-facture`, `#depenses`, `#paie`) |

---

## ➡ La suite

- **[02-drh.md](02-drh.md)** : si tu es DRH, tu participes aux décisions de salaires (impact direct sur la masse)
- **[07-automatismes.md](07-automatismes.md)** : pour comprendre comment les ventes/dépenses/paies arrivent automatiquement
- **[08-faq-depannage.md](08-faq-depannage.md)** : autres questions fréquentes
