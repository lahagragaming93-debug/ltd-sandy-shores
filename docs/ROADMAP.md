# 🗺️ Roadmap LTD Sandy Shores

> Chantiers en suspens, classés par priorité.
> Dernière MAJ : **2026-05-15 (soir)**

## ✅ Résolus depuis dernière MAJ (session 2026-05-15 partie 2)
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
