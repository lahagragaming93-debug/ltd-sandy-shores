# 🗺️ Roadmap LTD Sandy Shores

> Chantiers en suspens, classés par priorité.
> Dernière MAJ : **2026-05-19 (v1.7.1 — hotfix quotas pompiste shift UTC/Paris)**

## ✅ Résolus session 2026-05-19 — v1.7.1

- **Hotfix quotas pompiste shift UTC/Paris** : `currentWeekId()` côté serveur calculait en UTC alors que le frontend calcule en heure Paris. Ravitaillements / déclarations caoutchoucs validés entre lundi 00h-02h Paris étaient écrits dans la semaine précédente (clôturée) → quota pompiste à 0 sur `/employee`, paie estimée à 0. Fix avec le même pattern Paris que `cloturerSemaine` (commit `a259805`).
- **Script backfill** `firebase/functions/scripts/backfill-quotas-pompiste.mjs` : recompose les quotas attendus depuis `/redistributions` + `/declarationsCaoutchouc`, compare avec les `/quotasPompiste` existants, dry-run puis `--apply`.

## ✅ Résolus session 2026-05-18 (partie 3) — v1.7.0

- **Feature : onglet snapshot Sheet par semaine clôturée** (`firebase/functions/lib/snapshot-sheet-semaine.mjs`) créé/MAJ à chaque clôture. Bandeau titre + KPI cards + 3 sections tables (Ventes avec colonne Source, Dépenses, Paies). Backfill semaine 11/05 → onglet `Semaine 20 (11-17 mai 2026)` 467 lignes.
- **Helper `week-iso.mjs`** : extraction des helpers ISO (`weekIsoNumber`, `weekIsoLabel`, `snapshotSheetTitle`). Réduit la triplication backend.
- **Hotfix dashboard Sheet** : `cumulBeneficeNet` hors scope dans `buildFormatRequests` (ReferenceError qui crashait le batch de formatage → Dashboard sans mise en forme) + "Invalid Date" historique semaines (Firestore Timestamp objects).
- **Hotfix KPI Salaires versés sur /rh** : `wKeyCible = dateDebut.toISOString().slice(0,10)` shift en UTC → filtre `weekKeyAttribuee` rejetait toutes les paies. Acceptation d'un param `weekKey` explicite.
- **Hotfix pollution paies dashboard backend** : symétrique du fix listPaiesSemaine côté serveur, sinon bénéfice net semaine en cours mangé par paies S-1 (vu -93k$ → +4k$).

## 🟡 À surveiller / valider après usage

- **Tolérance auto-match paie ↔ snapshot** (±5% ou min 500$) : ajuster après 1-2 semaines d'usage réel.
- **Rôles snapshottés** : actuellement tous les `compteEnFinance` + `statut=='actif'`. Si patron veut exclure certains comptes (ex: lui-même, co-patron sans salaireDecide), à clarifier.
- **Snapshots W18 (semaine 11/05) à backfiller** : lancer `node firebase/functions/scripts/backfill-snapshot-paies-w18.mjs` APRÈS le deploy v1.6.0.
- **Quota pompiste sur semaine passée** : le sélecteur historique sur /employee lit `/quotasPompiste/{weekKey}_{uid}`. Si le format diverge pour d'anciennes semaines, le quota retombe à 0 (graceful, pas de crash).
- **Doc /semaines/2026-05-04** : `dateDebut` peut être manquant côté Firestore (semaine ancienne). À constater dans Sheet onglet `resumé` ligne correspondante ; si vide, c'est normal (pas de bug code).

## ✅ Résolus session 2026-05-18 (partie 2) — v1.6.0

- **Fix formats Google Sheet** (`csvResume` + `csvPaies` + `format-sheet.js`) : weekKey → `S20 2026` (helper `weekIsoLabel`), `$` partout, dates `dd/MM/yyyy`, datetime `dd/MM/yyyy HH:mm:ss`, col Statut élargie, `cleanNomBot()` pour virer `<@discordId>`, `Période` paies remplie via `weekKeyAttribuee`. Header `Prime hebdo (potentielle)` clarifié.
- **Option B déployée** : `paie-calc.mjs` (snapshot calculator), `/paiesEstimees/{weekKey}_{userId}` à chaque clôture (manuelle + cron, try/catch englobant idempotent), Cloud Function `marquerPaieVersee` (direction+DRH+admin-tech), `/rh` colonne **Versé ?** + KPI **Reste à verser** + auto-détection match paie. Rules Firestore : read direction+DRH, write false.
- **Dashboard KPI Bénéfice net cumulé depuis reprise** : bandeau full-width vert/rouge entre Subventions/Trésorerie et Conformité TTE. Wording semaine courante clarifié ("CA − dépenses − salaires versés"). Historique : col Semaine en `S20 2026`.
- **Sélecteur de semaine factorisé `semaine-selector.js`** : composant réutilisable (courante + N dernières clôturées au format `Semaine 20 du lundi 11/05 au dimanche 17/05/2026`). Déployé sur `/ventes`, `/employee`, `/rh` (remplace l'ancien toggle binaire). Mode lecture seule sur semaines passées (bouton modifier → 🔒 disabled).
- **`period-filter.js` étendu** : nouvelle option "Semaine dernière" + `injectSemainesHistoriques()` qui ajoute un optgroup "📅 Semaines clôturées" avec dropdown direct. Plus besoin de passer par "Personnalisé" pour voir une semaine N-1.
- **Helper `weekIsoLabel`** dans `formatters.js` + `dashboard-core.mjs` + `index.js` (3 modes : court `S20 2026`, full `S20 2026 (11/05 → 17/05)`, long `Semaine 20 du lundi 11/05 au dimanche 17/05/2026`).
- **Version 1.6.0** + JOURNAL + ROADMAP + docs guide (01-direction, 02-drh, 05-vendeur, 06-pompiste).

## ✅ Résolus session 2026-05-18 (partie 1)
- **Option A** : toggle "Cette semaine / Semaine précédente" sur `/rh` (commit `8aa0975`). Permet au patron de voir les estimations de la semaine clôturée après lundi 00h00.
- **Bouton 🔒 Clôturer la semaine — 4 fix successifs** :
  - Fenêtre paie post-dim (commit `d991339`) : ramassage des paies versées lundi N+1 00h00 → moment du clic
  - Cron étape 2 skip si déjà clôturée manuellement (préserve traces patron)
  - Wording modal explicite (commit `ffb0c38`) : titre "Clôturer la semaine précédente" + badge vert avec dates exactes "lun 11 mai → dim 17 mai"
  - **Bug timezone Paris** (commit `a259805`) : Cloud Functions en UTC rejetaient à tort le clic du lundi matin (~01h Paris = ~23h UTC dimanche). Fix via conversion `now` UTC → horloge Paris via `Intl.DateTimeFormat`.
- **Tag paies `weekKeyAttribuee`** (commit `b5f0356`) : à la clôture, chaque paie ramassée est taggée avec la semaine logique à laquelle elle appartient. Frontend `listPaiesSemaine` filtre les paies tag autre semaine. Fix bug "bénéfice net W19 = -94k$" sur dashboard.
- **Clôture effective W18** : Blake MARS a clôturé le 18/05/2026 01:24:30 Paris (note "RAS"). CA 266 174 $, masse 97 458 $, bénéfice NET -793 249 $ (déficit cohérent reprise S15-17 + dette THORPE).
- **Scripts d'inspection** : `check-cloture-w18.js`, `backfill-tag-paies-w18.js`.

## ✅ Résolus depuis dernière MAJ (session 2026-05-15 partie 4)
- **Versioning v1.5.0** : source unique `public/js/version.js`, signature `BLATV` affichée discrètement (sidebar bas, footer global, README, meta tags). Convention SemVer.
- **Transition rôle Discord** d'Andrew BEAUCHAMP de co-patron → citoyen validée sans risque technique (zéro hardcode d'ID Discord dans le code, bot indépendant via son propre token, rôle site Firestore inchangé).
- **Script `debug-paies-f1.js`** : outil de diagnostic chaîne de capture paies F1.

## ✅ Résolus session 2026-05-15 partie 3
- **Filtre période dynamique sur les KPI** : nouvel util `public/js/utils/period-filter.js` (5 options : semaine / mois / 30j / depuis ouverture / personnalisé), appliqué sur 4 pages (Banque LTD + Mes paies + Revenus carburant + Dashboard). Solde banque et tout ce qui est "état instantané" (stocks, alertes, stations) restent live indépendamment du filtre.
- **Comptabilité, Ventes, Employee, RH, Stations** : volontairement non-touchées (logique RP-week-locked pour primes/déclaration IRS, ou état instantané).

## ✅ Résolus session 2026-05-15 (partie 2)
- Compta Sheet : **refresh complet en 1 clic** (Dashboard + 4 feuilles data) — fin du cache IMPORTDATA 1h qui bloquait les modifs Firestore → Sheet. Module `lib/refresh-importdata.mjs` + cache-bust `&_t={timestamp}`.
- Habillage 4 feuilles data : bordures grille, format `25 000 $`, format date `dd/MM/yyyy HH:mm:ss`, couleurs conditionnelles 🟢 vert pâle / 🔴 rouge pâle sur Déductible (Depenses), zebra ivoire/blanc (Ventes/Paies/résumé)
- Format date ISO côté `comptaExport.dateIso` → Sheets reconnaît comme vrai datetime + tri/filtres date intelligents
- Bug badge fournisseur côté UI Compta : `reclasserDepense` fait un **re-match automatique** après save → pose `fournisseurLabel` + `fournisseurPatternId`
- Script `backfill-fournisseur-label.js` pour reposer le fournisseur sur dépenses passées matchant un pattern
- Renommage bouton "Rafraîchir Dashboard Sheet" → "Rafraîchir doc comptabilité"
- Cleanup scripts debug session (3 fichiers one-shot supprimés)

## ✅ Résolus session 2026-05-15 (partie 1) et avant
- Bug DRH/Blake "0 $" salaire estimé → fix `salaireDecide ?? plafond` (commit 712ba34)
- Bug heures Teodomiro `cumul=0` (index Firestore manquant + service en cours ignoré) → fix (commit 267f433)
- Compte Jeff Taylor supprimé totalement (Firestore + Auth)
- Pompiste peut corriger stock en cas d'incohérence IG/site (avec raison + alerte direction)
- Pompiste a sa modal Ravitailler directe sur Mon espace (litres + select station)
- Vente partenaire = 2,1× automatique (33 produits backfillés)
- Salaire DRH = 18 000 $ fixe / Salaire RV = pro-rata CA
- Factures supprimées IG auto-détectées via parser `factureCancel` + backfill historique
- TTE complet intégré (12 chapitres) en mémoire + guide site `10-tte-reference.md`
- Mapping fournisseurs auto-classification dépenses (Yootool/Fournisseur LTD/HDM/Dynasty 8/Achat essence)
- Dashboard Sheet pro piloté par Node.js (6 KPIs + subventions + engagements + conformité TTE)
- Bouton 🔄 Rafraîchir + bouton 🔒 Clôturer la semaine (avec confirm IRS) page Compta
- Cron `dashboardKeepAlive` (check intégrité A1, restaure si écrasé par Apps Script user)
- Bénéfice auto direction/responsable-vente (calcul depuis items + prixAchat + aliases)
- Engagements de remboursement : CRUD admin + auto-détection remboursement Discord + alertes 7j avant échéance
- Subvention Abraham THORPE 790k$ marquée + dette 300k$ tracée (échéance 11/06/2026)
- Fix bug critique dédup `onFacture` (Teodomiro : 3 ventes 300$ même montant rebindées au même manuel)
- Cleanup repo (peek-*, backup-*, scripts Apps Script API échec)

---

## 📅 Prochaine session (2026-05-15)
**Configurer les autres stations essence pour parser les ventes**
- Renseigner le **N° pompe FiveM** sur chaque station via Stations → ✏ Modifier → champ "N° pompe FiveM"
- Setté ce champ remplit `cfg.fivemPompesMap[N°] = stationId` → permet à `onBankAccount` (canal `xbankaccount`, raison "Redistribution N°XXXXX") de **décrémenter le bon stock** à chaque vente carburant
- État actuel : seulement quelques stations ont leur N° pompe renseigné, les autres ventes carburant ne sont pas attribuées à la bonne station
- Demander au patron les N° pompe in-game pour : Route 68 LTD, Route 68, Aérodrome Sandy Shores, Favélas, Vinewood, Cholla Springs, Algonquin Boulevard

---

## 🔴 Priorité haute — bloque des fonctionnalités

### 1. GB Foundry (acier + cuivre)
- **Statut** : fonderie fermée in-game depuis 2026-05-12
- **Impact** : prix d'achat **cuivre = 0 $** dans Firestore → toutes les recettes de craft utilisant du cuivre (Plomberie, Câble électrique, Lumière violette) ont des coûts de fab incomplets.
- **Acier** : prix temporaire 40 $ saisi (norme), valeur 60 $ utilisée en cas de pénurie (TEMP).
- **À faire** : actualiser prix cuivre dès la réouverture de la fonderie.
- **Comment** : Stocks → onglet 📦 Achat fournisseur → ✏ Cuivre → renseigner prixAchat.

### 2. Tissu (intrant Sac en jute)
- **Statut** : prix d'achat = 0 $, fournisseur inconnu.
- **Impact** : le craft Sac en jute est **bloqué** (recette : 1×Corde + 1×Tissu → 2×Sacs, mais coût impossible à calculer).
- **À faire** : identifier le fournisseur du Tissu in-game + renseigner le prix unitaire.
- **Comment** : Stocks → onglet 📦 Achat fournisseur → ✏ Tissu.

### 3. Bug stock négatif (cola-zero et autres)
- **Statut** : 351 unités d'écart entre cumul des mouvements et stock affiché pour `cola-zero` au 2026-05-13.
- **Cause** : le bot Discord ne loggue PAS d'`inventory-remove` pour certains items (cola-zero notamment) → les ventes bot consomment du stock virtuel sans le décrémenter côté serveur.
- **Workaround actuel** : ajustement manuel du stock par le patron (raison "réapro" / "ajustement").
- **À faire** : améliorer le mapping items dans le bot Faab'Hook OU faire que `onFacture` décrémente lui-même le stock à partir des `items` parsés (avec garde-fou contre double-décrément).
- **Lien** : voir mémoire `projet_bug_stock_negatif_bot.md` (Claude Code).

---

## 🟠 Priorité moyenne — améliorations utiles

### 4. Lumière violette : décalage prix vs recette
- **Statut** : prix actuel 50 $ vente / 21,92 $ achat. Recette calcule 47,36 $ TEMP / 118,40 $ vente x2.5.
- **Décision patron** : rien changer pour le moment. À reprendre quand l'acier repassera à 40 $ (fin pénurie GB Foundry) et qu'on validera la stratégie prix.

### 5. Bidon vide vs Bidon d'essence
- **Statut** : un seul produit `bidon-essence` (37,50 $ achat) sert à la fois pour ravitailler les stations ET comme intrant craft Jerrican.
- **Question patron 2026-05-13** : "on verra ça plus tard" (à clarifier si on doit créer un produit séparé `bidon-vide` distinct).
- **À faire** : décider si on garde la fusion ou si on sépare. Pas urgent.

### 6. Fève de Cacao
- **Statut** : produit existe au catalogue (`feve-cacao`, intrant matière première), prix d'achat = 0, fournisseur "À définir".
- **À faire** : renseigner quand un craft chocolat sera mis en place. Pas urgent.

### 7. Charbon + Bobine de cuivre — confirmer fournisseur
- **Statut** : prix unitaires 10 $ / 18,75 $ saisis d'après les recettes données par le patron, mais **fournisseur non renseigné**.
- **À faire** : identifier où sont achetés ces deux items in-game et tagguer le fournisseur via Stocks → ✏ → champ "Fournisseur".

---

## 🟢 Dette technique — pas urgent mais à planifier

### 8. Node.js 20 décommissionné le 2026-10-30
- **Statut** : Cloud Functions tournent en Node 20.
- **Action** : passer à Node 22+ avant fin octobre.
- **Comment** : `firebase/firebase.json` → modifier `runtime: 'nodejs22'`, tester localement, redeployer toutes les fonctions.
- **Lien** : voir mémoire `projet_dette_technique_runtime.md`.

### 9. firebase-functions à upgrade
- **Statut** : version actuelle dans `package.json` est ancienne (warning au déploiement).
- **Action** : `npm install --save firebase-functions@latest` dans `firebase/functions/`, vérifier breaking changes.
- **À planifier** : août/septembre 2026 (avant la migration Node 22).

### 10. Système "prix TEMP" pour matières premières
- **Statut** : pas de mécanisme automatique. Quand l'acier passe de 40 $ à 60 $ (pénurie), le patron ajuste manuellement le prixAchat dans Stocks.
- **À faire** : OK pour rester en ajustement manuel. Pas besoin de système complexe.

---

## 💡 Idées / améliorations potentielles

### 11. Page "Achat fournisseur" séparée pour le suivi des achats
- Aujourd'hui : onglet dans Stocks épicerie qui affiche les produits intrant + ceux avec fournisseur.
- Idée : page dédiée avec historique des achats (qui a acheté quoi à quel fournisseur, quand, combien).
- À discuter avec le patron quand le craft sera plus mature.

### 12. Recettes craft modélisées en Firestore
- Aujourd'hui : recettes en dur dans la documentation (ROADMAP + mémoire).
- Idée : doc `/recettes/{id}` avec ingrédients + qte sortie. Permettrait de calculer le coût de fab automatiquement et alerter sur les ruptures matières premières.
- Gros chantier — à reprendre quand le craft sera vraiment utilisé.

### 13. Vue "Mes ventes à déclarer" notifiée
- Aujourd'hui : l'employé doit aller sur Mon espace pour voir les factures à déclarer.
- Idée : notification push (web) ou ping Discord au vendeur quand une facture in-game attend déclaration depuis > 5 min.
- À considérer si les vendeurs oublient souvent.

---

## 📋 Comment utiliser cette roadmap

- **Lecture** : pour comprendre ce qui est en suspens et pourquoi.
- **Mise à jour** : à chaque session, déplacer les items vers ✅ (fait), ou ajouter de nouveaux items.
- **Priorité** : 🔴 = bloque ; 🟠 = utile à régler ; 🟢 = pas urgent.
- **Lien JOURNAL** : voir `docs/JOURNAL.md` pour l'historique chronologique des sessions.
