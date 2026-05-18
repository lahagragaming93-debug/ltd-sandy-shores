# 03 — Inventaire complet des features (v1.7.0)

> Vue d'ensemble de tout ce qui marche aujourd'hui. Pour le détail technique d'une feature, voir les fichiers dédiés (`04-pages-frontend.md`, `05-cloud-functions.md`, `07-discord-bot.md`, `08-google-sheets.md`).

---

## 🔐 Authentification & Comptes

- **Création du premier compte = patron** : pas de signup public, l'inscription crée automatiquement le compte patron RP
- **Inscription des employés** : depuis le panel Admin par la direction (créer email + password initial)
- **Mode "Voir comme"** : direction/DRH/admin-tech peuvent consulter `/employee?asUser=<uid>` pour voir l'espace perso d'un employé (lecture seule)
- **Reset password** : direction via panel Admin
- **Rôles** : `patron`, `co-patron`, `drh`, `responsable-vente`, `responsable-pompiste`, `vendeur-novice/intermediaire/experimente`, `pompiste-novice/intermediaire/experimente`, `admin-technique`
- **Statuts** : `actif`, `suspendu`
- **`compteEnFinance`** : flag séparé, indique si l'employé apparaît dans les calculs de masse salariale

---

## 💰 Comptabilité

### Saisie dépense manuelle (depuis `/comptabilite`)
- Formulaire : raison, montant, type (matières premières, frais véhicule, etc.), déductible (oui/non), fournisseur
- Suggestion automatique de classification via mapping `/config.global.fournisseurs`
- Validation patron obligatoire (badge `🔒 Validé` vs `💡 suggestion`)

### Mapping fournisseurs / déductibilité (`/admin`)
- Liste de patterns : match par compte cible / raison contient / boutique N°XXX
- Chaque pattern → catégorie + déductible (true/false)
- Le bot Discord matche les nouvelles dépenses contre cette table
- Patron peut ajouter / modifier / supprimer un pattern

### Engagements de remboursement (`/admin`)
- CRUD dettes (ex: subvention IRS) avec montant initial, remboursé, restant, échéance
- Statut `actif` / `rembourse` / `annule`
- Affiché dans le Dashboard Sheet sous "📋 ENGAGEMENTS DE REMBOURSEMENT" avec badge couleur selon délai restant
- Cron `cronAlertesEngagements` envoie une alerte si échéance ≤ 7 jours

### Subventions reçues (`/banque`)
- Tagging d'une entrée `banqueLtd` comme `categorieEntree: 'subvention'`
- Visible dans le Dashboard sous "🏛 SUBVENTIONS REÇUES"
- Non imposable (TTE Art. 4-2.16)

---

## 🛒 Ventes

### Saisie automatique (bot Discord)
- Le bot écoute `#facturation-ig` → parse l'embed FaabHook → `POST /botIngest`
- Stocke en `/ventes` avec `source: 'discord'`, `factureId`, `montant`, `vendeurDiscord`, `clientNom`, etc.

### Déclaration manuelle vendeur (site)
- Sur `/employee` ou `/ventes` (selon rôle), bouton "📝 Déclarer une vente"
- Modal : factureId (le numéro IG), client, produits[{produitId, quantite}], paiement
- Stocke en `/ventes` avec `source: 'manuelle'`, `factureId: 'M20260518-0001'` (généré)
- Permet le calcul de la commission (cf paie vendeur)

### Déduplication
- Quand bot + manuelle pour la même vente → match par montant + timestamp + vendeur
- Pose `cachee: true` sur l'un des deux (priorité à la manuelle car contient le détail produits)
- Filtres : `/ventes` (site) et `comptaExport` excluent les `cachee=true`

### Modification / annulation
- Direction + responsable vente + DRH peuvent modifier une vente (raison, client, montant)
- `annulee: true` marque une vente supprimée IG (via F1 menu)
- Trace dans `/alertes` si annulation suspecte (fraude)

---

## 👥 Ressources humaines

### Effectif et estimations
- `/rh` affiche table : Nom, Rôle, ID Discord, Heures, CA/Quota, Salaire estimé, Statut
- Calcul live des estimations en temps réel pour la semaine en cours
- Plafonds TTE intégrés (cf `10-tte-rules.md`)

### Snapshots paies (Option B v1.6.0+)
- À chaque clôture (manuelle + cron lundi 00h), création de `/paiesEstimees/{weekKey}_{userId}`
- Fige : montant estimé, CA, caParticulier, bidons, caoutchoucs, role, prenom, nom
- Champ `paye: false` par défaut

### Colonne Versé ? (sur `/rh` semaine clôturée)
- Sélecteur semaine → snapshot mode → colonne checkbox **Versé ?**
- Cocher = `POST marquerPaieVersee` Cloud Function → met `paye: true`, `datePaiement: serverTimestamp`
- KPI **Reste à verser** = somme des snapshots non payés
- Auto-détection match `/paies` ↔ snapshot (tolérance ±5% ou min 500$)

### Sélecteur historique
- Composant `semaine-selector.js` réutilisé sur `/rh`, `/ventes`, `/employee`
- Liste semaine en cours + N dernières semaines clôturées au format `Semaine 20 du lundi 11/05 au dimanche 17/05/2026`
- Persistance sessionStorage

---

## ⛽ Stations-essence

### Stations + pompes
- 8 stations gérées (cf `init-stations.js` pour la liste)
- Chaque station a N pompes avec stock, prix, type carburant (Essence/Gasoil/Premium)
- Stocks matières premières : bidons vides, caoutchoucs

### Ravitaillement
- Pompiste va `/stations` → bouton "🛢 Ravitailler une station"
- Modal : quantité bidons, station cible
- Crée un doc `/stations/{id}/ravitaillements` + déduit le stock bidons + ajoute au stock pompe
- Logs Discord (`#logs-ig` essence) → parser confirme l'opération côté bot

### Quotas hebdo + scoring
- Pompiste novice : 1700 bidons + 800 caoutchoucs / semaine
- Score = % d'atteinte des deux quotas
- Visible sur `/employee` (vue perso) et `/stations` (responsable)

### Revenus carburant
- `/revenus-carburant` affiche ventilation par station, par jour, par pompiste
- Collection `/redistributions` agrégée depuis les ventes carburant

### Alertes
- Stock pompe faible → alerte sur `/stations`
- Anti-vol : cron `verifierSortiesExpirees` détecte les sorties bidons sans retour ravitaillement

---

## 📦 Stocks épicerie

- Catalogue produits avec catégories : nourriture, boisson, hygiène, matériel
- Distinction **particulier vs professionnel** (`pourPro: true`) — commission vendeur uniquement sur particulier
- Seuils d'alerte par produit → badge orange si stock < seuil
- Resync depuis logs FiveM via `scripts/resync-stocks.js` (rattrapage)

---

## 🏦 Banque LTD

- `/banque` affiche mouvements compte (entrées xbankaccount + sorties dépenses combinées)
- Tri chronologique décroissant
- Solde temps réel
- Filtre période : semaine / mois / 30j / depuis ouverture / personnalisé
- Tagging entrée comme subvention (visible Dashboard)

---

## 📅 Workflow clôture hebdomadaire

### Phase 1 — Préparation (dimanche)
- Patron vérifie masse salariale, résout dépenses "À classifier"

### Phase 2 — Cron auto étape 1 (lundi 00h00 Paris)
- `clotureHebdo` fige CA + dépenses semaine S-1 → statut `cloturee-partielle`
- Crée snapshots `/paiesEstimees`
- Crée onglet Sheet `Semaine N (jj-jj mois aaaa)` (audit IRS figé)
- Renomme onglets live `Ventes / Dépenses` avec le titre de la nouvelle semaine

### Phase 3 — Action manuelle patron (lundi 00h-01h)
- Patron ferme le LTD IG
- Verse les paies en jeu (commande IG, log Discord automatique)
- Coche les cases Versé ? sur `/rh`
- Clique 🔒 Clôturer sur `/comptabilite` (coche obligatoire confirmation IRS)
- → statut `cloturee-manuelle`, masse salariale + bénéfice net figés

### Phase 4 — Cron auto étape 2 (mardi 21h05) — filet de sécurité
- `clotureHebdoPaies` finalise si pas déjà fait
- Skip si statut `cloturee-manuelle`

---

## 📊 Dashboard direction (`/dashboard`)

- KPI temps réel filtrables par période (semaine, mois, 30j, depuis ouverture, personnalisé, **semaine historique** S20, S19, ...)
- Sections : Ventes, Dépenses, Paies, Stations, Banque, Stocks
- Alertes urgentes en haut (stock critique, sortie expirée, échéance dette)

## 📊 Dashboard Sheet (Google)

- Onglet `📊 Dashboard` généré côté serveur
- Bandeau titre `Semaine 21 — du 18/05/2026 au 24/05/2026`
- 3 KPI haut : CA Semaine / Charges déductibles / Résultat imposable
- 3 KPI milieu : Masse salariale / Bénéfice net / Impôt estimé
- 3 KPI bas : Subventions reçues / Trésorerie banque LTD / Solde opérationnel
- **Bandeau full-width** : 📈 BÉNÉFICE NET CUMULÉ depuis reprise (vert/rouge)
- Section ENGAGEMENTS DE REMBOURSEMENT
- Section CONFORMITÉ TTE — Échéances de la semaine (3 indicateurs)
- 5 dernières ventes + 5 dernières dépenses
- Historique des semaines (10 dernières clôturées)
- Footer audit IRS

---

## 📑 Google Sheet "Comptabilité"

Onglets actuels (v1.7.0) :
- **📊 Dashboard** (généré serveur, refresh manuel ou cron keep-alive)
- **Ventes Semaine N (jj-jj mois aaaa)** (live, semaine en cours, IMPORTDATA filtré)
- **Dépenses Semaine N (jj-jj mois aaaa)** (live, semaine en cours, IMPORTDATA filtré)
- **Semaine N (jj-jj mois aaaa)** ×N (snapshots figés, créés à chaque clôture, audit IRS)

Onglets supprimés en v1.7.0 :
- ~~resumé~~ (info dans HISTORIQUE des semaines du Dashboard + onglets snapshots)
- ~~Paies~~ (info dans la section Paies de chaque onglet snapshot)

---

## 🤖 Bot Discord — features

- Écoute des canaux : `#facturation-ig`, `#depenses`, `#paie`, `#logs-ig`
- Parsers : facture, dépense, paie, ravitaillement, etc.
- Auto-classification dépenses via mapping fournisseurs
- Notifications anti-vol (alertes site)
- Endpoint `botIngest` côté Functions pour l'écriture sécurisée Firestore

---

## 📖 Guide intégré (`/guide`)

- 11 chapitres markdown rendus dans la page
- Restriction par rôle : `09-comptabilite` et `10-tte-reference` réservés direction + DRH + admin-tech
- Navigation TOC sidebar, deep-links `?guide=xx-yyy`
- Bouton 🖨 Imprimer / PDF
- Estimation temps de lecture par chapitre

---

## 🛠 Outils techniques (page Admin)

- Liste des users + édition rôle/statut
- Mapping fournisseurs CRUD
- Engagements CRUD
- Config globale (quotas, prix carburant, etc.)
- Tools : reset password, ajustement stock manuel, débloquer employé

---

## 🔔 Notifications & Alertes

- Toast UI (success / error) sur actions critiques
- Cron `cronAlertesEngagements` (échéance dette proche)
- Cron `verifierSortiesExpirees` (anti-vol stock)
- Section ALERTES en haut du Dashboard direction

---

## 📈 Versioning

- `public/js/version.js` source unique de vérité
- Affiché sidebar bas + footer
- SemVer (`MAJOR.MINOR.PATCH`)
- Bump à chaque release : commit `Feat vX.Y.Z : ...` ou `Fix vX.Y.Z : ...`
