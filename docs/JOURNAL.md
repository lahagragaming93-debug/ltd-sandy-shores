# 📖 Journal de bord — LTD Sandy Shores

> Document de reprise pour les prochaines sessions de travail.
> Dernière mise à jour : **2026-07-02 (v1.25.0 — onglet Déclaration de livraison + paie livreur fixe 5 000 $)**

---

## ✅ 2026-07-02 — v1.25.0 : Déclaration de livraison + paie livreur fixe

Nouvel onglet **« Livraisons »** pour le livreur + refonte de sa paie.

### Onglet « Déclaration de livraison »
- Le **livreur** déclare ses livraisons : **date, heure, client livré, produit, quantité, montant total facturé**. Nouvelle collection `/livraisons`.
- **Aucune incidence sur le CA** : traçabilité pure (le montant correspond à la vraie facture émise en jeu). Le patron consulte l'**historique** (filtre par semaine, KPI livraisons / quantité / montant).
- Accès : livreur (déclare + voit les siennes), direction + DRH (consultent tout, suppression possible). `permissions.js` (`ACCESS.livraisons`), `layout.js` (nav + icône truck), `api.js` (`ajouterLivraison` / `listenLivraisons` / `listenLivraisonsLivreur`), `firestore.rules` (`/livraisons`).
- Le livreur **garde** la déclaration de ventes comptoir (flux inchangé).

### Paie livreur : fixe 5 000 $
- `salaireLivreur` ne dépend plus du CA : **5 000 $ fixe** (le livreur honore les livraisons de la semaine ; le patron verse selon ce qui a été réellement fait, en s'appuyant sur l'historique). `paie-calc.mjs` + `utils/paie.js` + `PLAFOND_SALAIRE['livreur']`.

---

## ✅ 2026-07-02 — v1.24.0 : permission de modification par employé (stocks)

Ajout d'un système de **permissions de modification** accordables employé par employé, en plus des accès aux pages (même mécanique `accesSupp`).

- **Nouvelle permission `stocks_edit`** : modifier les stocks (ajuster une quantité, éditer / créer un produit, corriger l'inventaire). Rôles éditeurs par défaut inchangés (direction, DRH, resp. vente, resp. pompiste, super-admin).
- **Chef d'équipe** (et tout autre rôle) peut désormais recevoir ce droit **individuellement** via **Admin > Modifier le compte > « Permissions de modification »**.
- Le modal « Modifier le compte » sépare désormais **Accès aux pages** et **Permissions de modification**.
- `firestore.rules` : les écritures stock (`/stocks`, `/produits`, `/historiquePrix`, `/mouvementsStock`) passent d'un accès « tous les chefs d'équipe » en bloc à un grant **par employé** (`aSupp('stocks_edit')`) — aucun chef d'équipe n'éditait via l'UI, donc sans impact.
- Fichiers : `permissions.js`, `stocks.js`, `admin.js`, `firestore.rules`.

---

## ✅ 2026-07-01 — v1.23.0 : poste Livreur, alerte déclaration, périmètres resserrés, accès par employé

Grosse session sur l'app employé. **`firestore.rules` + Cloud Functions redéployés, front via push GitHub Pages.**

### Rattrapage données — ventes orphelines (nom inversé)
- **Diego Castillo da Silva** : 13 factures bot de la semaine avec `vendeurId=null` (le bot n'avait pas matché — prénom/nom inversés au moment de l'émission). Script admin → `vendeurId` corrigé sur ces 13 docs → **12 260 $ de CA** ré-attribués (paie S27). Aucune vraie vente touchée, CA global/IRS inchangé.
- **Vérifié empiriquement** (snapshot `/paiesEstimees` S26) : une vente bot NON déclarée mais avec un `vendeurId` valide **compte déjà** dans la paie (calcul = somme des ventes non-cachées par `vendeurId`, `montantParticulier ?? montant`). Une bot ORPHELINE (vendeurId vide) ne compte pour personne — c'était tout le problème de Diego. La déclaration sert au `montantParticulier` exact (exclure le pro) + la traçabilité.

### Alerte « vente à déclarer »
- Le bloc d'alerte sur l'espace perso était gardé par `isVendeur` → le **chef d'équipe** (et resp-vente, livreur) ne voyait jamais ses factures bot à déclarer. Étendu à `isVendeurDeclarateur` (`employee.js`).

### Nouveau rôle « livreur »
- 1 rôle unique `livreur`, payé comme un vendeur (part CA prorata, **plafond 15 000**, pas de fixe, pas de bonus fab), **exempté d'avertissement quota** (le rôle n'étant pas `vendeur-*`, il échappe nativement à `genererAvertissementsAuto`). Déclare ses livraisons comme un vendeur (alerte + modal facture bot, produits particuliers).
- `permissions.js` (ROLES, ROLE_LABELS, PLAFOND_SALAIRE, `isLivreur`, ACCESS, `isVendeurDeclarateur`, `isEmployeeView`, `canManageUser` resp-vente), `paie.js` + `paie-calc.mjs` (`salaireLivreur`), `vente-modal.js`, badge `layout.js`. **Pas encore d'employé livreur en base** — le patron convertira un vendeur en fin de semaine.

### Cohérence affichage rôles (chef-equipe + livreur)
- Audit complet : `isVendeur/isPompiste/isResponsable/isDirection` ne couvrent ni chef-equipe ni livreur → ils étaient omis de plusieurs écrans. Corrigé : `comptabilite.js` (section « Chef d'équipe », livreur avec vendeurs, **filet « Autres » anti-omission**), `rh.js` (label progression + détail CA/factures), `layout.js` (badges `users`/`package`), `ventes.js` (filtre pilotage), `guide.js`/`tuto.js` (routage).

### Périmètres resserrés (décision patron 2026-07-01)
- **Chef d'équipe** ET **Responsable-vente** : ne voient plus que **Stocks épicerie · Stations essence · Ventes** (+ espace perso, paies, guide, tuto). Retrait : dashboard, compta, banque, RH, revenus carburant, notes de frais, **admin**. Le resp-vente ne gère donc plus les comptes (réservé direction + DRH). `permissions.js` (`ACCESS`, `LECTURE_COMPTA`/`RH_FULL`).

### Accès supplémentaires par employé (overrides additifs)
- Nouveau champ `/users.accesSupp` = pages accordées à un employé **en plus** de son rôle, géré depuis **Admin > Modifier le compte > « Accès au site »** (cases ; pages du rôle cochées+grisées). `canAccess(role, page, accesSupp)`, `requireAuth`, menu (`layout.js`), modal (`admin.js`).
- **Backend** `firestore.rules` : helper `aSuppGestion()` ajouté en **OR additif** aux collections compta/banque/RH/notes → les données chargent aussi pour l'employé à qui on a ouvert la page. Le menu (front) reste la barrière de navigation.
- NB : pour le **chef d'équipe**, tout marchait déjà côté données (il est dans `isComptaViewer`) ; le backend additif sert surtout aux autres rôles (resp-vente, vendeurs).

---

## ✅ 2026-06-21 — v1.22.0 : refonte paie Responsable Ventes + poste Chef d'équipe

Décision patron (Blake) : le **Responsable Ventes** repasse en modèle **hybride** et création d'un poste **Chef d'équipe**. Activation **datée** sur la clôture dominicale : nouvelle formule pour les semaines `>= 2026-06-22` uniquement (la semaine qui se termine le 21/06 reste à l'ancien modèle).
- **Responsable Ventes** : `10 000 fixe + 20% du CA perso (même taux qu'un vendeur expérimenté), plafonné à 7 000` → max **17 000** (atteint à 35 000 de CA). Réactive la commission sur ses ventes perso (annulée en mai).
- **Chef d'équipe** (nouveau rôle `chef-equipe`) : `8 000 fixe + 20% du CA perso, plafonné à 8 000` → max **16 000** (atteint à 40 000 de CA). Pas de bonus fabrication.
- Câblage complet du rôle : `permissions.js` (ROLES, ROLE_LABELS, ACCESS toutes pages, isVendeurDeclarateur, defaultLandingPage=ventes, PLAFOND_SALAIRE 16 000), miroir back `paie-calc.mjs`, `calculerPaieEstimee(weekKey)`, `csvMasseSalarialeEstimee` (index.js). Chef d'équipe : voit toutes les pages, peut éditer les stocks, NE crée PAS de fiche employé (réservé direction).
- Constante `PAIE_HYBRIDE_DEPUIS = '2026-06-22'`. weekKey propagé à `salaireEstime` (front) — fix dashboard.js + rh.js pour que la consultation d'une semaine passée n'applique pas la formule courante.
- **Cloud Functions redéployées** le 2026-06-21. Front (Pages) via push. RESTE (lundi 22) : déployer `firestore.rules` (accès chef-equipe : stocks write + lectures compta/banque) + basculer **Sakura** (vendeuse intermédiaire) en **Chef d'équipe** ; le Responsable Ventes reste **Hailey**.

## ✅ 2026-06-15 — v1.21.0 : ajout du « Sac en jute » aux quotas de fabrication vendeurs

Nouveau 6e produit dans le quota de fabrication hebdomadaire des vendeurs : **Sac en jute** (`sac-jute`).
- `public/js/utils/permissions.js` + `firebase/functions/lib/paie-calc.mjs` : `sac-jute` ajouté à `PRODUITS_QUOTA_FAB` (front + back ; le calcul du bonus fab est générique → se propage seul).
- `public/js/pages/rh.js` : 6e champ dans le panneau « Quotas hebdomadaires » (direction). L'écran « Déclarer une fabrication » côté vendeur l'affiche automatiquement dès qu'un quota > 0 est défini.
- `public/js/data/produits.js` : entrée catalogue `sac-jute` (« Sac en jute », `enFabrication:true`) pour la résolution du nom + le stock à la fabrication.
- `vendeurDeclarerFabrication` valide désormais `sac-jute` → **Cloud Functions redéployées**.

---

## ✅ 2026-06-15 — v1.20.3 : RH affiche la bonne semaine au créneau de paie + robustesse de l'instantané

### Bug
À la session de paie (lundi 00h), la page **RH affichait 0 $** pour les salaires variables (vendeurs/pompistes). Deux causes cumulées :
1. Le sélecteur de semaine ouvrait par défaut sur la **« semaine en cours »** qui, dès lundi 00h00, est la **nouvelle semaine vide** (`startOfWeekRP` bascule sur le nouveau lundi) → `ca=0`/quotas=0 → `salaireEstime()` = 0. Les salaires fixes (direction/responsables) restaient affichés → « certains à 0 ».
2. L'instantané figé `/paiesEstimees` de la semaine clôturée (mode snapshot) était **incomplet** (clôture partielle → 13/19 employés figés à 0). Donc même en sélectionnant la semaine clôturée, des employés avec du CA restaient à 0.

Conséquence réelle (S24) : le patron a cru tout payer mais a **raté Morgan HARPER** et **sous-payé Sakura MARS**. Rappel : les **heures de service n'entrent pas** dans le calcul du salaire (vendeur = CA, pompiste = quotas).

### Correctif (frontend, sources `public/js`)
- **`utils/semaine-selector.js`** : nouvelle option `defaultLastClosed`. Au créneau de paie (lundi/mardi) et sans choix mémorisé, le sélecteur s'ouvre sur la **dernière semaine clôturée** (celle à payer) au lieu de la semaine en cours vide.
- **`pages/rh.js`** : passe `defaultLastClosed: true` ; **bandeau** d'alerte si la semaine en cours est vide (bouton « voir la semaine clôturée ») ; **fallback live** quand l'instantané `/paiesEstimees` est absent OU figé à 0 → le salaire est recalculé sur les ventes/quotas réels de la semaine sélectionnée (table + KPI « Salaires estimés » et « Reste à verser »). Un instantané de clôture partielle ne peut plus afficher 0 par erreur.

---

## 🐛 Hotfix 2026-06-08 — la clôture auto fermait la MAUVAISE semaine (en cours, vide) au lieu de la précédente

### Bug
Le cron `clotureHebdo` (lundi 00h) faisait `ref = now - 1ms`. Mais un cron ne se déclenche jamais à 00h00.000 pile (délai de qq ms) → `now - 1ms` retombait sur **lundi** → `weekRangeRPParis` renvoyait la **semaine EN COURS** (fenêtre quasi nulle → `ca=0`) au lieu de la précédente. Observé le 2026-06-08 : doc `/semaines/2026-06-08` « semaine 24 » vide, **semaine 23 jamais fermée**, lignes de paie semaine 23 non créées → patron bloqué pour ses payes.

### Correctif
- `firebase/functions/index.js` (`clotureHebdo`) : `ref = weekRangeRPParis(now).debut - 1ms` (ancre sur le lundi 00h de la semaine courante, puis recule au dimanche précédent) → **robuste au délai de déclenchement**. `clotureHebdoPaies` (mardi 21h, `now - 2j`) était déjà robuste.
- **Récupération** : supprimé le doc fantôme `/semaines/2026-06-08`, redéployé `clotureHebdo`, **relancé la clôture étape 1 via Cloud Scheduler** → `/semaines/2026-06-01` (semaine 23) recréée correctement (`ca=736 301`, `masse=0`) + snapshots de paie. Le patron paie + clôture manuellement comme d'habitude.
- **Aucune donnée perdue** : la clôture ne fait qu'un snapshot, elle ne supprime jamais les ventes/dépenses/payes brutes.

---

## ✅ Session 2026-06-07 — v1.20.0 : perf (carburant en agrégation serveur, CEF) + dépenses par catégorie IRS + JSON IRS auto Discord

### Performance (site lent à l'affichage, surtout en CEF FiveM)
Audit multi-angles : cause n°1 = le client **téléchargeait ~3 390 docs carburant/semaine (~450 Ko)** juste pour calculer **une somme** (CA carburant).
- **`getCarburantStatsSemaine`** ([public/js/api.js](public/js/api.js)) : **agrégation serveur Firestore** (`getAggregateFromServer` sum+count) → **0 doc rapatrié**, fallback `getDocs` si l'index n'est pas prêt (ne casse jamais). Index composite `redistributions (timestamp, montant)` ajouté + déployé. Branché sur **compta** + **dashboard**.
- **Page Revenus carburant** : table tronquée aux **200 dernières lignes** (totaux/KPI restent calculés sur tout) — évitait ~27 000 nœuds DOM d'un coup.
- **CSS CEF** : entête collante en **fond opaque** (au lieu de `backdrop-filter: blur` recalculé à chaque frame de scroll) ; fonds body en `scroll` (au lieu de `fixed`) ; `transition` retirée des lignes de table.
- **compta** : requête `services` inutile supprimée ; `masseEstimee` pré-indexé par vendeur (fin du O(users×ventes)).
- **v1.20.1** : **cache mémoire 60 s** pour `listUsers` + `listSemaines` (api.js, invalidé sur écriture user) → fin du re-fetch à chaque navigation ; **voile de chargement** avant l'auth (`auth.js`, retiré par `renderShell`, garde-fou 8 s) → fin de l'écran noir au démarrage.
- **v1.20.2** : **bundling** — chaque page = **1 fichier minifié** (`build.mjs` esbuild, lancé en **CI** via `npm install && node build.mjs` dans GitHub Actions ; sortie `public/js/dist/`, gitignorée) au lieu de ~14 modules ES en cascade ; Firebase reste **externe** (CDN). **Polices self-hosted (latin)** : 12 woff2 dans `public/fonts/` + `@font-face` → fin de l'`@import` Google **bloquant**. Build raté en CI = pas de déploiement (ancienne version intacte). Gros gain sur le 1er affichage, surtout en CEF.

### Comptabilité — dépenses par catégorie IRS
Le récap Dépenses est calé sur les **postes exacts de la déclaration IRS** (Matière première, Frais véhicules, Locations, Nourriture… / Autres non déductibles). **Primes hebdo/mensuelle estimées retirées** (jamais versées, hors résultat imposable). Le **paiement d'impôt** (`autre-deductible`) compte désormais en **non déductible** (comme le JSON IRS) → l'imposable affiché = la vraie déclaration.

### JSON IRS auto sur Discord (Cloud Function)
**`notifyDeclarationDiscord`** (trigger Firestore `semaines/{weekKey}`) : à la clôture complète d'une semaine (`cloturee` / `cloturee-manuelle`), génère le JSON IRS plat et le poste dans **#ltd-sandy** (mini-récap + bloc copiable + lien IRS). Secret `BLA_LTD_JSON_WEBHOOK`, idempotent via `/blaJsonPosted`. BLA ne calcule pas l'impôt (l'IRS le fait à l'import).

### Déploiement
Frontend (push `main`) + Functions (`notifyDeclarationDiscord`) + index Firestore. Bump `version.js` 1.19.0 → 1.20.0.

---

## ✅ Session 2026-06-03 — v1.19.0 : classification fiscale des entrées (don reçu, subvention) hors CA

### Besoin
Un **don de 300 000 $** (LTD Little Seoul → LTD Sandy) avait été saisi comme une **vente** → il gonflait le CA, les **salaires/quotas vendeurs** et la déclaration IRS. Le Code TTE **Art. 3-1.5** impose un don reçu **à part** (poste « Montant Dons Reçu », imposable **30 %** au-delà de 50 000 $), **hors CA** (Art. 4-2.1).

### Correctif
- **Cloud Function `categoriserVente`** (direction) : pose `categorieFiscale` sur une ligne de vente (`vente` / `don-recu` / `don-verse` / `subvention` / `autre-entree`).
- **Page Ventes** : sélecteur « Catégorie fiscale » par ligne + badge.
- **CA exclu partout** (audit, 17 emplacements) : dashboard, RH, employé, compta, ventes, **banque** (KPI Recettes), et **salaires/quotas vendeurs** (`lib/paie-calc.mjs`, `lib/dashboard-core.mjs`, `clotureHebdoPaies`). Le don reste compté en **trésorerie** (banque).
- **Snapshot de clôture** (`clotureHebdo` + `cloturerSemaine` + `lib/snapshot-sheet-semaine.mjs`) : stocke `donsRecus` + affiche « Dons reçus (hors CA · imposable 30 %) » (page Compta + Sheet).
- **`comptaExport?type=ventes`** : nouvelle colonne « Catégorie fiscale ».
- **Portail patron (BLA, `portals/ltd-sandy`)** : le JSON IRS met le don en `dons_recus` (hors CA) ; prévisionnel = don imposé **30 %** à part.
- **Déploiement** : Functions (`ltd-sandy-shores-f3919`) + frontend (push `main`) + portail BLA. Bump `version.js` 1.18.0 → 1.19.0.

---

## ✅ Session 2026-06-02 — v1.18.0 : suppression employé = fiche + compte Auth (fin des orphelins)

### Problème
Supprimer un employé sur le site retirait sa **fiche Firestore** mais **pas son compte Firebase Auth** (le client SDK ne peut supprimer que le compte connecté). Résultat : comptes Auth **orphelins** → à la recréation d'un même identifiant, `createUserWithEmailAndPassword` renvoyait **`auth/email-already-in-use`** (l'email interne `{username}@ltd-sandy-shores.local` étant déjà pris), alors que l'employé n'apparaissait nulle part dans Administration.

### Correctif
- **Nouvelle Cloud Function `supprimerEmploye`** ([firebase/functions/index.js](firebase/functions/index.js)) — calquée sur `adminResetPassword` : POST + `Authorization: Bearer <idToken>` → `verifyIdToken` → caller doit être patron/co-patron/admin-technique. Supprime **le compte Auth (`adminAuth.deleteUser`) ET la fiche `/users/{uid}`**. Ignore `auth/user-not-found` (orphelin déjà parti). Garde-fous : pas d'auto-suppression, pas de suppression d'un patron sauf par patron/admin-technique. Les ventes/paies/services restent (audit TTE).
- **Bouton « Supprimer »** ([public/js/pages/admin.js](public/js/pages/admin.js)) : appelle désormais `supprimerEmploye` (au lieu du `deleteUser` Firestore-only). Message de confirmation + toast mis à jour (« fiche + login », plus de « pense à supprimer depuis Firebase Auth »).
- **Création** : message clair sur `auth/email-already-in-use` (« identifiant déjà pris par un compte de connexion existant… ») au lieu de l'erreur Firebase brute.
- **Déploiement** : Functions (`firebase deploy --only functions`) + frontend (push `main`). Bump `version.js` 1.17.0 → 1.18.0.

---

## ✅ Session 2026-06-02 — v1.17.0 : fix fuseau clôtures auto + paies S-1 hors total Sorties (Banque)

### Bug de fuseau (clôtures automatiques) — [firebase/functions/index.js](firebase/functions/index.js)
- `clotureHebdo` et `clotureHebdoPaies` calculaient leurs bornes de semaine avec `setHours(0,0,0,0)` exécuté en **UTC** (runtime Functions) → début de semaine ancré à **lundi 02h00 Paris** l'été → **trou lundi 00h-02h** : les opérations de ce créneau étaient exclues du snapshot d'audit IRS (ex. réel W23 : ventes 1952101/1952103 de 720 $ à 01h38/01h39 + dépense essence 81 $ à 00h53).
- Corrigé : bornes via `weekRangeRPParis(ref)` (horloge Paris, DST-correct). `clotureHebdo` garde un `fin` **exact** (`now - 1ms`) ; `clotureHebdoPaies` vise la semaine close via `now - 2 jours`. Fenêtre de paie (lundi 02h → lundi+1 02h Paris) conservée, désormais juste été **et** hiver.
- `weekRangeRPParis(ref)` rendu **paramétrable** (rétro-compatible : sans argument = `new Date()`, comportement inchangé pour les endpoints, `renameLiveOnglets`, etc.).
- Vérifié par test isolé (été/hiver) : bornes justes, opération de la zone morte ré-incluse.
- **Déploiement backend** : `firebase deploy --only functions` (ltd-sandy-shores-f3919).

### Paies S-1 hors total Sorties — [public/js/pages/banque.js](public/js/pages/banque.js)
- Les sorties **« Paye ponctuelle de membre »** datées du **lundi** (= paies de la semaine S-1, versées après la clôture du dimanche 23h59) sont exclues du total **Sorties** + **Net** de la semaine affichée, mais restent **visibles** avec un tag « paie S-1 · hors total ». Le **transfert d'impôt** reste compté (déclaré en fin de semaine).
- Helper `estPaieLundi(m)` : raison ~« paye ponctuelle » (ou `type='paie'`), gated lundi Paris. `depOps` capte désormais `typeDepense`.
- Vérifié live W23 : **165 774 $** exclus (= total `/paies` au centime), Sorties 282 578 → **116 804 $**, transfert IRS conservé.
- Bump `version.js` 1.16.0 → **1.17.0**. Déploiement frontend GitHub Pages (push `main`).

---

## ✅ Session 2026-06-01 — v1.16.0 : salaire estimé dans les pilotages + déplacement pilotage pompistes

- **[public/js/pages/ventes.js](public/js/pages/ventes.js)** : colonne **Salaire estimé** ajoutée au Pilotage vendeurs (`salaireEstime` avec l'objectif de quota de la semaine affichée).
- **Pilotage pompistes DÉPLACÉ** de Stations essence → **Revenus carburant** ([public/js/pages/revenus-carburant.js](public/js/pages/revenus-carburant.js)). Raison : Stations essence est consultée par les pompistes (qui n'ont pas à voir ces infos de management) ; Revenus carburant est réservée direction/DRH/responsable-pompiste. Inclut son sélecteur de semaine dédié, l'affichage des dimensions actives uniquement, et la colonne **Salaire estimé**.
- **[public/js/pages/stations.js](public/js/pages/stations.js)** : panneau pilotage + fonction `chargerPilotagePompistes` + sélecteur retirés ; imports devenus inutiles nettoyés (`initSemaineSelector`, `salaireEstime`, `listUsers`, `listQuotasSemaine`, `weekId`).
- **Revenus carburant** : filtre de période par défaut passé de `30j` à `semaine` (cette semaine).
- Frontend only, lecture seule. Bump `version.js` 1.15.1 → 1.16.0. Aucun déploiement backend.

---

## ✅ Session 2026-06-01 — v1.15.1 : colonne Heures dans le pilotage vendeurs

- **[public/js/pages/ventes.js](public/js/pages/ventes.js)** : ajout d'une colonne **Heures** (somme `services.duree` par vendeur, format `durationHM`) au panneau Pilotage vendeurs, juste après le Rôle. Triable, suit le sélecteur de semaine. Charge `listServicesSemaine(debut, fin)` en parallèle des quotas. **Pilotage pompistes non touché** (demande patron : vendeurs uniquement).
- Frontend only, lecture seule. Bump `version.js` 1.15.0 → 1.15.1.

---

## ✅ Session 2026-06-01 — v1.15.0 : pilotage vendeurs (Ventes) + pilotage pompistes amélioré + snapshot quota

### Demande patron
Le responsable vente n'a pas accès à RH. Lui donner un suivi des quotas de ses vendeurs directement dans Ventes. Idem améliorer le pilotage pompistes (n'afficher que les dimensions actives) + pouvoir voir les vraies valeurs d'objectif des semaines passées.

### Pilotage vendeurs (NOUVEAU) — [public/js/pages/ventes.js](public/js/pages/ventes.js)
- Panneau « Pilotage vendeurs » (gaté direction + super-admin + `responsable-vente`), sous le tableau des factures. **100% lecture seule, frontend** (lit ventes + `quotasVendeur` + config, comme RH).
- Par vendeur : **CA particulier** réalisé/quota (barre) + **statut CA**, **fabrication** (chaque produit actif faits/quota) + **statut Fabrication** (2 statuts séparés), bouton « Voir » → espace employé.
- **Suit le sélecteur de semaine** de la page (donc semaines passées consultables sans RH).
- RH reste bloqué pour le resp. vente (inchangé).

### Pilotage pompistes amélioré — [public/js/pages/stations.js](public/js/pages/stations.js)
- **Dimensions désactivées masquées** : si quota caoutchoucs = 0, la colonne disparaît (et inversement). On ne montre que l'actif.
- **Sélecteur de semaine** ajouté au panneau pilotage (`chargerPilotagePompistes(debut, fin, wId, cfgQuota)` paramétré).

### Snapshot des objectifs de quota à la clôture — [firebase/functions/index.js](firebase/functions/index.js)
- `clotureHebdo` (étape 1, lundi 00h) fige désormais `quotaConfig` (`quotaBidons`, `quotaCaoutchoucs`, `quotaCAVendeur`, `quotaFabrication`) dans `/semaines/{weekKey}`.
- Les 2 pilotages lisent cet objectif figé pour une semaine clôturée (via `payload.semaine.quotaConfig`, déjà chargé par le sélecteur — zéro requête en plus). Fallback sur la config actuelle pour la semaine en cours ET les semaines clôturées AVANT cette mise en place.
- **Limite** : non rétroactif (les semaines déjà clôturées n'ont pas la donnée). Se résorbe semaine après semaine.
- Déploiement ciblé : `firebase deploy --only functions:clotureHebdo`.
- Bump `version.js` 1.14.2 → 1.15.0 (UI client → auto-reload).

---

## ✅ Session 2026-06-01 — v1.14.2 : Pain à burger + Lumière Violette dans les quotas fabrication vendeur

### Demande patron
Pouvoir fixer des quotas de fabrication aux vendeurs sur **Pain à burger** et **Lumière Violette**, comme les produits déjà craftables.

### Constat
Les 2 produits existaient déjà au catalogue ([produits.js](public/js/data/produits.js)) — `lumiere-violette` (déjà `enFabrication`) et `pain-burger`. Mais les quotas de fabrication ne sont PAS pilotés par le flag `enFabrication` : ils itèrent la constante **`PRODUITS_QUOTA_FAB`** (déclarée en double, front + back, à garder synchro). Précédent : `bouteille-eau-purifiee` y est sans être `enFabrication` → pas besoin de toucher les flags produits.

### Changements code
- **[`public/js/utils/permissions.js`](public/js/utils/permissions.js)** + **[`firebase/functions/lib/paie-calc.mjs`](firebase/functions/lib/paie-calc.mjs)** : `PRODUITS_QUOTA_FAB` passe de 3 à 5 entrées (+`pain-burger`, +`lumiere-violette`).
- **[`public/js/pages/rh.js`](public/js/pages/rh.js)** : panneau « Quotas hebdomadaires » — 2 champs ajoutés (`q-fab-pain`, `q-fab-lumiere`) + lecture + écriture dans `quotaFabrication`.
- **[`public/js/pages/employee.js`](public/js/pages/employee.js)** : **aucun changement** — le formulaire « Déclarer une fabrication » est déjà dynamique (`PRODUITS_QUOTA_FAB.filter(quota>0)`). Les produits apparaissent au vendeur dès que le patron met un quota > 0.
- **Déploiement Cloud Functions** requis (paie-calc.mjs sert à `vendeurDeclarerFabrication` validation + `genererAvertissementsAuto` + snapshot paies estimées).
- Bump `version.js` 1.14.0 → 1.14.2 (changement UI client → auto-reload).

---

## ✅ Session 2026-06-01 — v1.14.1 hotfix : onglet « Dépenses » du Sheet montrait les paies

### Symptôme (remonté par le patron après sa 1re clôture du nouveau système)
Clôture OK, paies versées après lundi 00h00. Sur le **site** la compta était correcte, mais dans le **Google Sheet**, l'onglet live « Dépenses Semaine … » affichait encore les lignes `type=paie` (versements timestampés `01/06 00h06+`).

### Cause
`csvDepenses()` (endpoint `comptaExport?type=depenses`, [firebase/functions/index.js](firebase/functions/index.js)) renvoyait **toutes** les lignes `/depenses` de la semaine RP courante, **y compris `type=paie`**. Les paies sont écrites en double dans `/depenses` (artefact legacy) ET `/paies`. Versées lundi 00h+ (créneau clôture S-1), leur timestamp lundi les rangeait dans la semaine en cours. Le **site** filtrait déjà ces paies (`depensesHorsPaie`) et la clôture aussi — mais l'onglet Sheet affichait le CSV brut.

### Fix
- **`csvDepenses()`** : `continue` sur `type ∈ {paie, paies, salaire, salaires}`. Aligne l'endpoint sur le comportement du site. Les paies gardent leur onglet « Paies » dédié + sont captées dans la masse salariale du snapshot à la clôture.
- Pas de bump `version.js` (fix backend pur, aucun JS client modifié → pas de reload client nécessaire).
- Déploiement ciblé : `firebase deploy --only functions:comptaExport`. Puis « Rafraîchir doc comptabilité » pour casser le cache IMPORTDATA.

### À surveiller (dette connue, pas corrigé ici)
- **Numérotation des onglets** : le snapshot était « Semaine 22 (25-31 mai) » et le nouvel onglet live « Semaine 22 (31 mai - 06 juin) » → deux « Semaine 22 » + date de début un cran trop tôt (dimanche). Bug d'étiquetage dans la logique de renommage des onglets à la clôture, à traiter séparément.

---

## ✅ Session 2026-05-31 — v1.14.0 : refonte visuelle (sidebar repliable, icônes SVG, header) + protocole clôture

### Refonte visuelle (purement esthétique, aucune logique métier touchée)
- **Nouveau [`public/js/utils/icons.js`](public/js/utils/icons.js)** : set d'~35 icônes SVG inline (style outline, `currentColor`, taille paramétrable) + helper `icon(name, {size, cls, title})`. 100% CEF-safe, zéro dépendance externe.
- **[`public/js/layout.js`](public/js/layout.js)** :
  - Tous les emojis d'UI (nav, badges de rôle `ROLE_DISPLAY`, icônes d'alertes `alertIcon`, header `☰ ← 🔔 ⎋`, bandeaux `🎭 🔒 ✓ →`) → **icônes SVG**.
  - **Catégories de nav repliables** : chaque groupe est un `<button class="group-title" data-group-toggle>` + chevron ; état persité en `localStorage` (`ltd-navgroup:<groupe>`).
  - **Sidebar repliable en rail** (bouton `#btn-rail-toggle`) : réduit à 76px (icônes seules + tooltip natif), état persité (`ltd-sidebar-collapsed`). `href`, `data-nav-link`, permissions, IDs et handlers **inchangés**.
- **[`public/css/western.css`](public/css/western.css)** :
  - `--glass-blur` / `--glass-blur-soft` → `none` : **plus de `backdrop-filter`** → glass simulé via rgba/dégradés, CEF-safe ET **supprime la cause racine** du bug de containing-block sur `position:fixed` (hotfix v1.13.3/4).
  - Styles rail + catégories repliables (chevron, `max-height`), dimension des icônes SVG.
  - **Sidebar compactée** (logo 96→54px, polices/espacements réduits) + **shell desktop plafonné à `height:100vh`** → toute la sidebar (6 catégories + 14 items) tient sur **un seul bloc sans scroll** sur écran standard ; sur petit écran la nav scrolle en interne au lieu de la page.

### Page Comptabilité — protocole de clôture
- **2 boutons PDF BLA retirés** (`generateProtocolePdf?...short` / `...long`) : ils décrivaient un cycle « dimanche soir » erroné. Bouton « Ouvrir le portail BLA » conservé.
- **Vrai protocole** ajouté en panneau `<details>` dépliable, basé sur le guide §3 + la logique réelle des crons.
- **Réordonné** : payes → clôture (cadenas, chiffres figés) → **déclaration IRS en DERNIÈRE étape** (portail BLA → JSON → site IRS). La case de la modale passe de « j'ai déclaré IRS » à « salaires versés + chiffres vérifiés ». **Backend `cloturerSemaine` non touché** (reçoit toujours `confirmationIRS:true` en interne — pas de redéploiement).
- Emojis de commentaires nettoyés (`🔄 🔒 ⚙`). Récap salaires **Discord** : emojis conservés (usage normal Discord, SVG impossible là-bas).

### Routine simplify
- Protocole : 6 titres d'étape + 4 listes au style inline répété → classes `.pc-step` / `.pc-list`.
- Skips assumés : memoize `icon()`, extraction util collapse/storage, système de tokens CSS, template partiel → out-of-scope / incohérent avec le style vanilla inline du codebase / micro-opti sur chemin froid.

---

## ✅ Session 2026-05-26 — v1.13.4 / v1.13.5 / v1.13.6 : infra auto-reload + portail modaux

### Contexte
Suite au hotfix v1.13.3 (modaux pompiste clipped a cause de `backdrop-filter` sur `.panel` ancetre), Gordy CHAPMAN voyait toujours le bug sur sa tablette FiveM. Cache CEF agressif + impossibilite de Ctrl+Shift+R en jeu. 3 releases successives pour resoudre durablement.

### v1.13.4 — portail modaux dans employee.js
- **[`public/js/pages/employee.js`](public/js/pages/employee.js)** : apres `renderShell`, deplacement de tous les `.modal-backdrop` vers `document.body` via `appendChild`. Garantit que `position: fixed; inset: 0` couvre bien le viewport quel que soit l'ancetre (echappe au containing block pose par `backdrop-filter` / `transform` / `filter` / `contain`).

### v1.13.5 — portail generique + auto-reload polling
- **[`public/js/layout.js`](public/js/layout.js)** : portail modaux **promu dans `renderShell`** = applique automatiquement a TOUTES les pages, plus seulement employee. Idempotent grace au check `parentElement !== document.body`.
- **Polling auto-reload** : toutes les 5 min, `fetch('js/version.js?_t=NOW', { cache: 'no-store' })`, parse `VERSION` avec regex, compare a la `VERSION` chargee en memoire. Si differente → `location.reload()`. Skip si l'utilisateur tape dans un INPUT / TEXTAREA pour ne pas couper la saisie. Garde `window.__ltdVersionPolling` pour ne pas spawner un setInterval par navigation.
- Cache-busting via query string `?_t=Date.now()` pour bypasser le cache CDN GitHub Pages (`max-age=600` par defaut).
- **Permet aux clients FiveM/CEF de recuperer les nouvelles versions sans Ctrl+Shift+R**.

### v1.13.6 — cleanup post-routine
- **employee.js** : retrait du portail local (doublon, deja fait en generique dans layout.js).
- **Polling reduit 60s → 300s** (5 min) : les releases etant manuelles, 60s etait inutilement agressif (= 60 requetes/h/client). Decision agent simplify.

### Tool admin (commit séparé `00f616d`)
- **[`firebase/functions/scripts/force-relogin-all.mjs`](firebase/functions/scripts/force-relogin-all.mjs)** : cycle `disabled:true → 800ms → disabled:false` sur tous les comptes sauf direction (patron / co-patron / admin-tech). Force tous les clients connectes a se reloguer.
- **Utilise une fois ce soir** pour transitionner les 17 employes actuellement connectes vers v1.13.5 (sinon ils restaient bloques sur v1.13.4 a cause du cache CEF). Apres cette transition, le polling prend le relais : plus besoin de ce script pour les releases futures.

### Limites & notes ops
- Le cache CEF (Chromium Embedded Framework dans FiveM) est plus tenace que sur un navigateur classique. Le `force-relogin` Firebase Auth invalide la session mais ne vide pas necessairement le cache JS — Gordy a du fermer/rouvrir la tablette en plus. Pour les futures releases, le polling **dans v1.13.5+** detectera la nouvelle version et fera `location.reload()` (qui passe-through-cache via le `cache: 'no-store'` du fetch initial).
- Le polling fait `fetch('js/version.js')` en chemin relatif. **OK pour toutes les pages actuelles** (tous les HTML sont a `/public/`). Si on ajoute un jour une page dans un sous-dossier, repenser le chemin.

---

## ✅ Session 2026-05-26 — v1.13.3 hotfix modaux pompiste clipped dans `.panel`

### Bug remonte par un pompiste (Gordy CHAPMAN)
Screenshot patron : sur "Mon espace" (employee.html), le modal "Ravitailler une station" s'affichait coupé / superposé aux KPIs au lieu de couvrir le viewport. Les pompistes ne pouvaient pas faire leurs déclarations (boutons Valider/Annuler hors écran). Aussi affecté : "Corriger un stock" et "Note de frais essence".

### Diagnostic CSS
Les 3 modaux (`#modal-ravit`, `#modal-correc`, `#modal-note-frais`) étaient rendus **à l'intérieur** de `<div class="panel framed mb-3">` (le panel d'accueil "Salut Gordy !" qui contient les boutons d'action). Or `.panel` a `backdrop-filter: var(--glass-blur)` (introduit en v1.11.0 "glow up").

**Piège CSS** : `backdrop-filter` sur un ancêtre crée un nouveau **containing block** pour les descendants en `position: fixed` (même règle que `transform`, `filter`, `perspective`, `contain`). Conséquence : `.modal-backdrop { position: fixed; inset: 0; }` devenait relatif au panel d'accueil au lieu du viewport → modal contraint aux dimensions du panel, débordant sur les KPIs en dessous.

### Fix
- **[`public/js/pages/employee.js`](public/js/pages/employee.js)** : les 3 modaux pompiste sortis du `<div class="panel framed mb-3">` et placés au niveau racine de `.main` (juste avant `<div id="bloc-non-declarees">`). `.main` n'a pas de `backdrop-filter`, donc `position: fixed` redevient relatif au viewport.
- Commentaire ajouté pour documenter le piège (éviter qu'un futur refactor les remette dans un panel).

### Audit
Vérifié les 6 autres pages avec des modaux (`admin.js`, `rh.js`, `stocks.js`, `comptabilite.js`, `notes-frais.js`, `stations.js`) : **tous au top level**, pas le même bug. Le modal "Déclarer une vente" (`utils/vente-modal.js`) est créé dynamiquement et appendé à `document.body` directement (déjà bonne pratique).

### Note pour le futur
Si on rajoute un nouveau modal dans une page : **toujours au top level du `mainContentHtml`**, jamais dans un `.panel` ou un container avec `backdrop-filter` / `transform` / `filter`. Sinon le `position: fixed` ne couvre pas le viewport.

---

## ✅ Session 2026-05-26 — v1.13.2 ratio masse / CA aligne sur Art. 4-2.1 + simplify + cleanup

### Bug remonte par le patron
"108 304 $ de salaires versés sur 48 829 $ de CA" → ratio masse aberrant. Cause : le dénominateur du ratio TTE excluait les ventes carburant NPC auto (`source !== 'manuel-pompiste'`). Or TTE Art. 4-2.1 définit le CA comme "totalité des revenus" — l'IRS regarde le total, pas un subset métier.

### Fix masse salariale
- **[`public/js/pages/dashboard.js`](public/js/pages/dashboard.js)** + **[`public/js/pages/comptabilite.js`](public/js/pages/comptabilite.js)** : suppression des variables intermédiaires `caCarburantPompiste` et `caTotalTTE`. `checkMasseSalariale()` reçoit désormais `caTotal = caProduits + caCarburant (TOUT)`. Commentaire mis à jour avec référence Art. 4-1.13 + 4-2.1.
- Backend `firebase/functions/lib/dashboard-core.mjs` déjà correct (utilisait déjà `caTotal` sans filtre). Pas de changement backend.

### Routine simplify (suite v1.13.1)
3 reviews en parallèle, findings appliqués :
- **[`public/js/utils/formatters.js`](public/js/utils/formatters.js)** : commentaire `dateKeyLocal()` simplifié (retrait des numéros de version `v1.7.1` et `v1.13.1` qui se périment vite).
- **[`public/js/pages/admin.js:1406-1407`](public/js/pages/admin.js#L1406)** **(critical)** : `dateReception` et `dateEcheance` des engagements pré-remplies via `toISOString().slice(0,10)` → ces valeurs étaient ensuite **persistées en Firestore**. Passage à `dateKeyLocal()` (mêmes raisons que le hotfix TZ).
- **[`public/js/api.js:461`](public/js/api.js#L461)** : pattern `${y}-${m}-${day}` manuel remplacé par `dateKeyLocal(dateDebut)`. Le commentaire bug-doc devient redondant, retiré.
- **5 exports CSV** unifiés sur `dateKeyLocal()` (`revenus-carburant.js`, `ventes.js`, `banque.js`, `comptabilite.js`, `decouverte-items.js`) pour cohérence — impact cosmétique (nom de fichier) mais source de vérité unique pour la date.
- **[`public/js/pages/employee.js:332`](public/js/pages/employee.js#L332)** : double appel `.toDate()` factorisé en variable `ts`.

### Cleanup projet
- **[`.gitignore`](.gitignore)** : ajout `_backups/` (dossier untracked de sauvegardes locales qui apparaissait dans `git status`).
- **Scripts one-shot supprimés** (exécutés, récupérables via git history) :
  - `firebase/functions/scripts/swap-jerrican-mastic.mjs` (v1.10.0)
  - `firebase/functions/scripts/update-quota-ca-vendeur.mjs` (v1.13.0)
  - `firebase/functions/scripts/cleanup-produits-supprimes.mjs` (v1.13.0)
- **Conservés** : `init-*.js`, `backfill-*.mjs`, `force-refresh-*.js`, `resync-stocks.js`, `list-*.js`, `format-sheet.js` (réutilisables pour maintenance ad-hoc).

### Note pour le patron
- `docs/07-transmission.md` : procédure de passation au vrai patron, applicable une fois. L'agent cleanup l'a flaggé comme supprimable. **Non supprimé** par prudence (peut servir si nouvelle transmission). À décider plus tard.
- Le `_backups/` reste sur le disque local, juste retiré de `git status`. À toi de décider quoi en faire localement.

---

## ✅ Session 2026-05-26 — v1.13.1 hotfix TZ chart revenus carburant

### Bug remonté par le patron
Page Revenus Carburant, filtre "Cette semaine" : barre datée 24/05 (dimanche) avec 8 647 $ alors que la semaine en cours démarre lundi 25/05 00:00. Patron craignait que le KPI CA carburant (54 119 $) soit faussé.

### Diagnostic
Le KPI était correct : les 54 119 $ ne contenaient bien que des transactions de la semaine en cours (filtre `getPeriode()` utilise `setHours(0,0,0,0)` en heure locale Paris — OK).

Le bug était purement dans le **groupement du chart** (`revenus-carburant.js:248`) :
```js
const key = d.toISOString().slice(0, 10); // YYYY-MM-DD ← UTC, pas Paris
```
En heure d'été (CEST = UTC+2), une transaction du lundi 00h-02h Paris a un timestamp UTC du dimanche 22h-00h → `toISOString().slice(0,10)` retourne "2026-05-24" au lieu de "2026-05-25". Conséquence : les transactions de début de semaine étaient bucketées sur le dimanche précédent (24/05) au lieu du lundi (25/05).

Même classe de bug que v1.7.1 (weekId server vs client). Doc de `weekId()` documentait déjà le piège ; le call site `revenus-carburant.js` ne l'avait pas appliqué.

### Fix
- **[`public/js/utils/formatters.js`](public/js/utils/formatters.js)** : extraction d'un helper exporté `dateKeyLocal(d)` (YYYY-MM-DD en heure locale Paris). `weekId()` refactor pour s'en servir.
- **[`public/js/pages/revenus-carburant.js:249`](public/js/pages/revenus-carburant.js#L249)** : `toISOString().slice(0,10)` → `dateKeyLocal(d)` dans `renderChart()`. Commentaire mis à jour.
- **[`public/js/auth.js:96`](public/js/auth.js#L96)** : `dateEntree` lors de la création d'un user — passe aussi par `dateKeyLocal()` (persistance Firestore : un user créé à 01h Paris ne sera plus enregistré avec la date de la veille).

### Autres call sites de `toISOString().slice(0,10)`
Audités, **laissés tels quels** car cosmétiques (noms de fichiers CSV, pré-fill d'inputs `<input type="date">`) :
- `ventes.js:313`, `comptabilite.js:1043`, `banque.js:330`, `decouverte-items.js:202` : nom de fichier d'export CSV.
- `period-filter.js:131-132`, `admin.js:1406-1407` : valeur initiale d'inputs date HTML.

Impact négligeable (1 jour de décalage pendant 2h max chaque jour, sur de l'UX non-persistante).

---

## ✅ Session 2026-05-25 — v1.13.0 release

Bump SemVer MINOR : refonte paie vendeur (calc visible) + nouveau comportement déclaration fabrication = stock auto. Voir détail dans les 3 sous-sections ci-dessous.

### Routine simplify post-implementation
3 reviews (reuse / quality / efficiency) en parallèle. Findings appliqués :
- Constantes legacy `COMMISSION_VENDEUR` + `CA_PLAFOND_VENDEUR_LEGACY` retirées du code (front + miroir backend) — plus aucun import après refonte prorata 50k.
- `isNouveauSystemeVendeur()` réduite à un garde defensif (`q > 0`) au lieu d'un check de bascule. Doc allégée.
- `rh.js renderTable()` : hoist de `nouveauVendeur`, `quotaCAShow`, `quotaFabActif` hors de la boucle `rows.map()` (calcul 1 fois par render au lieu de N fois par row).
- `cleanup-produits-supprimes.mjs` dry-run : 3 paires de get séquentielles → 1 `Promise.all` groupé (3 RTT économisés).

---

## ✅ Session 2026-05-25 — Catalogue trim + stock auto sur déclaration fabrication

### Décisions patron
1. **Supprimer 3 produits** qui ne seront jamais fabriqués : `pioche`, `sac-jute`, `fillet` (du catalogue, des stocks, et du quota fabrication hebdo). Quota fabrication passe de 4 à **3 produits actifs** : eau purifiée / mastic carrosserie / visseries.
2. **Déclaration de fabrication = incrément stock automatique**. Avant : la CF `vendeurDeclarerFabrication` n'écrivait que `/fabrications` (audit) + `/quotasVendeur` (compteur). Le stock `/stocks/{produitId}` n'était pas touché. Maintenant : 1 batch atomique = 4 écritures (fab + quota + stock + audit mouvement).

### Changements code
- **[`public/js/data/produits.js`](public/js/data/produits.js)** : retrait des entrées `fillet`, `sac-jute`, `pioche`. Note de `corde` mise à jour (intrant craft Jerrican uniquement).
- **[`public/js/utils/permissions.js`](public/js/utils/permissions.js)** + **[`firebase/functions/lib/paie-calc.mjs`](firebase/functions/lib/paie-calc.mjs)** : `PRODUITS_QUOTA_FAB` passe de 4 à 3 entrées (pioche retirée).
- **[`public/js/pages/rh.js`](public/js/pages/rh.js)** : panel Quotas hebdo — input `Pioche` retiré (UI + lecture + écriture). Libellé bloc maj "bonus max 5 000 $".
- **[`public/js/api.js`](public/js/api.js)** : commentaire `getQuotaVendeur` aligné.
- **[`firebase/functions/index.js`](firebase/functions/index.js)** : `vendeurDeclarerFabrication` refondue en batch atomique. Désormais : audit `/fabrications` + increment `/quotasVendeur` + **increment `/stocks/{produitId}.quantite`** + audit `/mouvementsStock` (type `fabrication-vendeur`). Documenté : les intrants ne sont PAS décrémentés automatiquement (patron suit son stock intrant manuellement).
- **[`public/js/pages/tuto.js`](public/js/pages/tuto.js)** : steps 7 et 9 du tuto vendeur mis à jour (3 produits au lieu de 4).
- **[`public/guide/01-direction.md`](public/guide/01-direction.md)**, **[`02-drh.md`](public/guide/02-drh.md)**, **[`05-vendeur.md`](public/guide/05-vendeur.md)** : références "pioche/filet" retirées, exemples chiffrés réécrits avec produits restants.
- **[`firebase/functions/scripts/cleanup-produits-supprimes.mjs`](firebase/functions/scripts/cleanup-produits-supprimes.mjs)** : one-shot dry-run/--apply (3 produits + 3 stocks + retrait champ `quotaFabrication.pioche` de config).

### Firestore (déjà appliqué)
- 3 docs `/produits/{pioche,sac-jute,fillet}` supprimés.
- `/stocks/pioche` supprimé (stock=0, donc aucune perte). `sac-jute` et `fillet` n'avaient pas de doc stock.
- `/config/global.quotaFabrication.pioche` retiré (était déjà à 0 cette semaine).

### À vérifier
- Première déclaration de fabrication post-déploiement : que le `/stocks/{produitId}.quantite` s'incrémente bien (mouvement visible dans Stocks → Mouvements avec type=fabrication-vendeur).
- Les vendeurs qui avaient des compteurs `pioche` dans leur `/quotasVendeur/{weekId}_{uid}` ne plantent rien (le champ reste mais n'est plus lu par `PRODUITS_QUOTA_FAB`).

---

## ✅ Session 2026-05-25 — Paie vendeur : prorata 50k + bonus fab 5k

### Décision patron
Revoir le barème vendeur. Pompistes 13/14/15k inchangés, direction/DRH/responsables inchangés. Vendeurs Novice/Inter/Exp passent de :
- **Avant** : `quotaCAVendeur=30 000`, plafond part CA = 10/11/12k, bonus quota fab max = 3 000$
- **Après** : `quotaCAVendeur=50 000`, plafond part CA = **8/9/10k**, bonus quota fab max = **5 000$**

Plafond total inchangé : **13/14/15k** (= plafondCA + bonusMax). Calcul reste en prorata pur (`MIN(CA/quotaCAVendeur, 1) × plafondCA + score × bonusMax`).

### Changements code
- **[`public/js/utils/permissions.js`](public/js/utils/permissions.js)** : `PLAFOND_CA_VENDEUR` 10/11/12 → **8/9/10**, `BONUS_QUOTA_VENDEUR_MAX` 3000 → **5000**, `QUOTA_CA_VENDEUR_DEFAULT` 40000 → **50000**. `isNouveauSystemeVendeur` simplifiée en garde defensif (`q > 0`). Constantes legacy `COMMISSION_VENDEUR` et `CA_PLAFOND_VENDEUR_LEGACY` retirées du code (les snapshots `/paiesEstimees` stockent leurs propres valeurs et n'importent pas ces constantes au runtime).
- **[`public/js/utils/paie.js`](public/js/utils/paie.js)** : `salaireVendeur()` simplifié — branche legacy retirée (retourne 0 si quotaCA invalide), default param = `QUOTA_CA_VENDEUR_DEFAULT`. Doc maj.
- **[`firebase/functions/lib/paie-calc.mjs`](firebase/functions/lib/paie-calc.mjs)** : miroir backend aligné (mêmes constantes + même simplification de `salaireVendeur`). Libellé `formule` utilise `BONUS_QUOTA_VENDEUR_MAX` au lieu de "3k" en dur.
- **[`firebase/functions/index.js`](firebase/functions/index.js)** : fallback `quotaCAVendeur` 40000 → 50000 dans `genererAvertissementsAuto`.
- **[`public/js/pages/rh.js`](public/js/pages/rh.js)** : panel Quotas hebdo — défaut UI 30000 → **50000** (saisie + fallback parseQ). Fallback `quotaCAVendeur` aligné sur `QUOTA_CA_VENDEUR_DEFAULT`.
- **[`public/js/pages/employee.js`](public/js/pages/employee.js)** : espace vendeur — libellés simplifiés (plus de branche "ancien système"). Fallback `quotaCAVendeur` aligné.
- **[`public/js/pages/tuto.js`](public/js/pages/tuto.js)** : steps 7-8-9-10 du tuto vendeur réécrits avec les nouvelles valeurs (50k / 8-9-10k / 5k).
- **[`firebase/functions/scripts/update-quota-ca-vendeur.mjs`](firebase/functions/scripts/update-quota-ca-vendeur.mjs)** : one-shot pour écrire `config/global.quotaCAVendeur = 50000` (dry-run par défaut, `--apply` pour pousser).

### Doc & guides
- **[`public/guide/05-vendeur.md`](public/guide/05-vendeur.md)** : formule, exemples chiffrés (Inter 25k → 4500 part CA / 75% fab → 3750 bonus / total 8250), tableau plafond, FAQ.
- **[`public/guide/02-drh.md`](public/guide/02-drh.md)** : section "Comprendre les calculs de paie / Vendeur", exemples plafonnés.
- **[`public/guide/08-faq-depannage.md`](public/guide/08-faq-depannage.md)** : 2 réponses (formule + plafond CA).

### Méthode & cohérence
- Calcul de bout en bout (front + miroir backend) cohérent : un seul nouveau système prorata, plus de bascule active. Les paies déjà snapshottées (/paiesEstimees) ne sont pas recalculées (idempotence).
- Plafond total 13/14/15k volontairement inchangé : le patron a gardé les mêmes paliers TTE, seule la *répartition* CA/bonus change (le bonus fab prend plus d'importance).

### À faire avant fonctionnement complet
- Pousser `config/global.quotaCAVendeur = 50000` en Firestore : `cd firebase/functions && node scripts/update-quota-ca-vendeur.mjs --apply` (script prêt, en attente go patron).
- `git push` (en attente go patron — modif sensible, salaire courant impacté dès déploiement).

---

## ✅ Session 2026-05-25 — Resp Vente : édition stocks épicerie

### Demande patron
Redonner au Responsable Vente l'accès en modification des stocks épicerie (prix, seuils, quantités, ajustements). La création de nouveaux produits reste réservée à Direction / DRH / Resp Pompiste (cf. `canCreateProduit`).

### Changements code
- **[`public/js/pages/stocks.js`](public/js/pages/stocks.js)** : flag `editable` étendu à `responsable-vente`. Commentaire historique mis à jour (la ligne "Resp Vente reste exclu" du 2026-05-13 supprimée — annulée par la nouvelle décision).

### Backend
- Aucun changement côté `firestore.rules` : `responsable-vente` était déjà autorisé en écriture sur `/stocks`, `/produits` (update), `/mouvementsStock` (create), `/historiquePrix` (create). Seul le garde UI bloquait.

---

## ✅ Session 2026-05-23 — v1.10.1 classement ravitaillement pompiste

### Demande patron
Afficher un classement des meilleurs ravitailleurs sur l'espace pompiste pour pousser à la performance. Les ravitaillements au-delà du quota hebdo (les pompistes peuvent continuer à déclarer après plafond atteint) comptent pour ce classement — base d'attribution d'une future prime.

### Changements code
- **[`public/js/api.js`](public/js/api.js)** : nouveaux helpers `listRedistributionsRangeManuel(debut, fin)` et `listAllRedistributionsManuel()` — filtre serveur `source='manuel-pompiste'` (exclut corrections / sources auto).
- **[`public/js/pages/employee.js`](public/js/pages/employee.js)** : nouvelle section "🏆 Classement ravitaillement" dans `renderPompiste`, visible uniquement sur la semaine en cours (indépendante du sélecteur historique). Fonction `renderClassementPompiste()` qui charge en parallèle les datasets semaine / mois courant / total, agrège par `pompisteId`, trie par litres décroissants. 3 onglets : Semaine / Mois / Depuis embauche. Pompiste connecté mis en surbrillance.
- **[`firebase/firestore.indexes.json`](firebase/firestore.indexes.json)** : nouvel index composite `redistributions(source ASC, timestamp ASC)` pour les queries de classement avec filtre temporel.

### Méthode
- Métrique : litres ravitaillés (= source de vérité homogène, indép. de la station). Affichage litres + bidons en sous-info.
- Caoutchoucs exclus pour V1 (focus "meilleur ravitailleur").
- "Depuis embauche" : total brut sans normalisation — récompense l'ancienneté + l'activité.
- Visibilité : tous les pompistes-* + responsable-pompiste. Suspendus visibles uniquement s'ils ont des perfs (`litres > 0`), pour ne pas polluer le top.

### Déploiement
- `firebase deploy --only firestore:indexes` (sinon erreur "missing index" sur la query range).
- Pas de Cloud Function nouvelle, aucune écriture, lectures uniquement.

---

## ✅ Session 2026-05-23 — v1.10.0 paie vendeur : CA prorata + bonus quota fabrication

### Décision patron
Restructurer la paie vendeur pour décorréler la rémunération du seul CA. Le plafond CA passe à 30 000 $ avec un salaire CA plafonné à 10/11/12k selon grade ; les 3 000 $ restants pour atteindre le plafond total 13/14/15k proviennent d'un **bonus quota fabrication** (4 produits possibles : pioche, eau purifiée, mastic carrosserie, visseries). Bascule pilotée par `config.quotaCAVendeur` : reste à 40 000 = ancien système, baisse à 30 000 = nouveau système.

### Changements code
- **[`public/js/utils/permissions.js`](public/js/utils/permissions.js)** : `isNouveauSystemeVendeur(cfg|qCA)`, `PLAFOND_CA_VENDEUR` (10/11/12k), `BONUS_QUOTA_VENDEUR_MAX = 3000`, `PRODUITS_QUOTA_FAB`.
- **[`public/js/utils/paie.js`](public/js/utils/paie.js)** : `salaireVendeur(role, ca, fabrications, quotaFab, quotaCAVendeur)` avec aiguillage ancien/nouveau ; helpers `scoreQuotaFabrication`, `fabricationsFromQuotaDoc`.
- **[`public/js/data/produits.js`](public/js/data/produits.js)** : `mastic-carrosserie` ajouté (placeholder à compléter), `jerrican` supprimé. Helper `nomProduit(id)` exporté.
- **[`firebase/functions/index.js`](firebase/functions/index.js)** : nouvelle Cloud Function `vendeurDeclarerFabrication` (audit `/fabrications` + increment `/quotasVendeur/{weekId}_{uid}.{produitId}`). `genererAvertissementsAuto` ajoute les motifs fabrication non atteint.
- **[`firebase/functions/lib/paie-calc.mjs`](firebase/functions/lib/paie-calc.mjs)** : miroir backend du nouveau calcul, snapshotPaiesEstimees charge aussi `quotasVendeur`.
- **[`firebase/firestore.rules`](firebase/firestore.rules)** : règles `quotasVendeur` (read auth, write CF) + `fabrications` (read direction/DRH, write CF).
- **[`public/js/pages/rh.js`](public/js/pages/rh.js)** : nouveau panel centralisé "⚙ Quotas hebdomadaires" (pompiste + CA vendeur + 4 produits fabrication). Affichage modal détail vendeur avec décomposition CA + bonus.
- **[`public/js/pages/employee.js`](public/js/pages/employee.js)** : section "🛠 Déclarer une fabrication" (saisie libre par produit), barres de progression par produit, KPI score + bonus.
- **[`public/js/pages/stations.js`](public/js/pages/stations.js)** : modale config quotas supprimée, le bouton ⚙ pointe vers RH#panel-quotas-hebdo.
- **[`public/js/api.js`](public/js/api.js)** : `CF_BASE` dynamique (emulator local sur `localhost`, prod sinon). Helpers `getQuotaVendeur`, `listenQuotaVendeur`, `listQuotasVendeurSemaine`.
- **Tutos + guides** : [`tuto.js`](public/js/pages/tuto.js), [`05-vendeur.md`](public/guide/05-vendeur.md), [`02-drh.md`](public/guide/02-drh.md), [`08-faq-depannage.md`](public/guide/08-faq-depannage.md), [`01-direction.md`](public/guide/01-direction.md) — slides + sections "Comprendre ta paie" entièrement réécrites, jerrican retiré.

### Routine simplify post-implementation
Trois reviews (reuse / quality / efficiency) en parallèle. Findings appliqués :
- Helper `fabricationsFromQuotaDoc` unifie 4 call sites dupliqués (rh.js, employee.js, comptabilite.js, dashboard.js).
- Helper `nomProduit` exporté depuis `produits.js`, retire la duplication CATALOGUE.find(...) dans employee.js et rh.js.
- `PRODUITS_QUOTA_FAB` importé depuis `paie-calc.mjs` côté CF (supprime `PRODUITS_FAB` + `PRODUITS_QUOTA_FAB_CF` dupliqués dans index.js).
- `genererAvertissementsAuto` : pré-fetch en parallèle de users + ventes + quotasPompiste + quotasVendeur + avertissements existants → ~10-30× plus rapide (N round-trips séquentiels → 5 batch). Insertion via `batch.commit()` au lieu de N `.set()` séquentiels.
- `window.location.reload()` après déclaration fabrication → remplacé par re-fetch ciblé + `renderVendeur()` (économise ~3 reads).
- Code mort supprimé : alias `CA_PLAFOND_VENDEUR = 30000` jamais utilisé hors import, `quotaFabActif` calculé jamais lu.

### Compatibilité
- **Non-rétroactif** : les semaines déjà clôturées gardent leur snapshot intact. Le calcul historique reste l'ancien tant que `quotaCAVendeur >= 40 000`.
- **Bascule manuelle** : tant que le patron laisse `quotaCAVendeur = 40 000` (valeur Firestore par défaut actuelle), tous les vendeurs voient l'ancien système. Pour activer le nouveau : baisser à 30 000 sur le panel RH > Quotas hebdo.
- Le `swap-jerrican-mastic.mjs` (script ponctuel) retire le doc Firestore `jerrican` et ajoute `mastic-carrosserie` avec placeholders.

### À faire avant déploiement prod (manuel)
1. `firebase deploy --only functions:vendeurDeclarerFabrication,firestore:rules`
2. `node firebase/functions/scripts/swap-jerrican-mastic.mjs` (optionnel — synchronise Firestore avec le catalogue code)
3. Quand prêt à activer : panel RH > Quotas hebdomadaires → quotaCAVendeur = 30 000 + saisir quotas fabrication par produit + Enregistrer.

---

## ✅ Session 2026-05-19 — v1.7.1 hotfix quotas pompiste affichés à 0

### Bug remonté par le patron
Gordy CHAPMAN (pompiste-novice) a ravitaillé 10 stations cette semaine (1000 bidons), mais sur `/employee` ses KPIs affichaient **0 bidon, score 0%, salaire estimé 0 $**. Idem pour les autres pompistes.

### Diagnostic
La donnée était bien dans Firestore : `/quotasPompiste/2026-05-18_V5PFBSK0JBZ10F3qwa0ARuOrkri1` = 1000 bidons. Le serveur écrit correctement. C'est la **lecture** qui se trompe de doc.

### Cause : bug timezone dans `weekId()` côté frontend
[`public/js/utils/formatters.js:72`](public/js/utils/formatters.js#L72) — `weekId()` faisait :
```js
const start = startOfWeekRP(d);   // lundi 00:00 LOCAL (Paris)
return start.toISOString().slice(0, 10);
```
Le `start` est lundi 00:00 Paris **mais** `toISOString()` convertit en UTC : en CEST (UTC+2), lundi 18 mai 00:00 Paris devient **dimanche 17 mai 22:00 UTC**, la slice rend `"2026-05-17"`.

Conséquence : le serveur stocke le quota dans `2026-05-18_{uid}` (calculé en Paris) mais le client lit `2026-05-17_{uid}` → doc absent → bidons=0, paie estimée=0.

Ironique : le commentaire de `weekRangeFromKey` juste en-dessous documente déjà ce piège ("Parse en local pour eviter le decalage UTC qui projetterait le lundi au dimanche d'avant") mais n'avait pas été appliqué à `weekId()` lui-même.

### Cause secondaire : `currentWeekId()` côté serveur calculait aussi en UTC
[`firebase/functions/index.js:2057`](firebase/functions/index.js#L2057) — même pattern. Pas le symptôme principal (le serveur en UTC se trompait dans la même direction donc le mismatch était constant), mais incohérent avec le reste du code (clôture, snapshots) qui calcule en Paris. Corrigé aussi pour cohérence.

### Fix
- **Frontend** : `weekId()` réécrite pour extraire Y-M-D en **heure locale** (`start.getFullYear()` / `getMonth()+1` / `getDate()`) sans passer par `toISOString()`.
- **Backend** : `currentWeekId()` réécrite avec le même pattern Paris que `cloturerSemaine` (commit `a259805`) — `toLocaleString('sv-SE', { timeZone: 'Europe/Paris' })`.

### Backfill (préventif, pour le scénario UTC serveur)
Script [`firebase/functions/scripts/backfill-quotas-pompiste.mjs`](firebase/functions/scripts/backfill-quotas-pompiste.mjs) :
- Recompose les quotas attendus depuis les sources de vérité (`/redistributions` + `/declarationsCaoutchouc`).
- Compare avec les `/quotasPompiste` existants et liste les écarts.
- `--apply` réécrit les docs en mode merge.

Au lancement du 19/05 : **0 écart détecté** sur les 14 derniers jours (les ravitaillements n'étaient pas tombés dans la fenêtre lundi 00h-02h Paris). Donc le serveur n'avait pas causé de perte. Mais le script reste utile si le bug serveur s'était déclenché.

### Version
- `public/js/version.js` : `1.7.0` → **`1.7.1`** (PATCH — bugfix).

### Commandes appliquées
```bash
firebase deploy --only functions:pompisteRavitaillerManuel,functions:pompisteDeclarerCaoutchoucs
# Frontend push GitHub Pages (hosting=GitHub Pages, pas Firebase Hosting) :
git add public/js/utils/formatters.js public/js/version.js firebase/functions/index.js \
        firebase/functions/scripts/backfill-quotas-pompiste.mjs docs/JOURNAL.md docs/ROADMAP.md
git commit -m "Hotfix v1.7.1 : weekId() client lisait la mauvaise semaine (UTC slice)"
git push
```

---

## ✅ Session 2026-05-18 (partie 3) — v1.7.0 onglet snapshot Sheet + hotfixes

### Hotfix v1.6.1 — Dashboard Sheet cassé après refresh
- `buildFormatRequests` utilisait `cumulBeneficeNet` hors scope (`ReferenceError`) → crash de tout le batch de formatage → Dashboard sans aucune mise en forme (juste valeurs brutes). Signe déduit depuis la valeur écrite en row 17.
- Historique des semaines affichait "Invalid Date" car `s.dateDebut`/`s.dateFin` sont des Firestore Timestamp objets, pas des string parseables par `new Date()`. Utilisation de `toDate()` avec fallback.

### Hotfix KPI Salaires versés à 0 sur /rh
- `listPaiesSemaine` calculait `wKeyCible = dateDebut.toISOString().slice(0, 10)` → shift en UTC (Paris CEST → dateDebut lundi 00:00 = dimanche 22:00 UTC), donc slice retournait le dimanche au lieu du lundi. Le filtre `weekKeyAttribuee === wKeyCible` rejetait alors TOUTES les paies. Acceptation d'un param `weekKey` explicite passé depuis `rh.js` (wId).
- Symétrique côté backend dans `dashboard-core.chargerDonnees` : ajout du filtre `weekKeyAttribuee === weekKeyCourant` sur les paies semaine. Sinon le lundi matin après clôture, les paies versées pour la semaine précédente polluent le bénéfice net affiché de la semaine en cours (vu -93k$ ramené à +4k$ après fix).

### Diagnostic écart 100 231 vs 97 458 $ sur snapshots /rh
Le user a coché "Versé" sur les 14 snapshots, mais KPI Salaires versés reste à 97 458 $ vs 100 231 $ estimés.
- Cause : un employé "Crook" (nom RP) a été supprimé par le patron après la clôture. Sa trace n'existe plus dans /users ni /paies. L'écart 2 773 $ correspond à des montants individuels versés inférieurs aux estimations TTE pour 6 vendeurs.
- C'est un bon argument pour la feature snapshot : pour les semaines à venir, même si un compte est supprimé après clôture, son snapshot reste figé sur `/rh` (collection `/paiesEstimees` séparée).

### Feature v1.7.0 — Onglet snapshot Sheet par semaine clôturée
À chaque clôture (manuelle + cron `clotureHebdo` étape 1), création/MAJ d'un onglet dédié dans le Sheet Comptabilité.

- **Module `firebase/functions/lib/snapshot-sheet-semaine.mjs`** : exporte `snapshotSheetSemaine({db, sheets, weekKey, weekDebut, weekFin, semaineData})`.
  - Titre : `Semaine 20 (11-17 mai 2026)` (numéro ISO + plage de dates en français).
  - Bandeau titre rouge sang + sous-titre + horodatage du snapshot.
  - 3 KPI cards en haut : CA total · Charges déductibles · Bénéfice net (chiffres figés depuis `/semaines/{weekKey}`).
  - 3 sections tables : **Ventes** (toutes les ventes !cachee && !annulee, colonne Source IG/Site/Rattrap.), **Dépenses** (hors paies), **Paies** (fenêtre lun N+1 → mar N+1 21h Paris, filtrées par `weekKeyAttribuee`).
  - Onglet créé avec `tabColor: C.blood` pour distinguer des onglets live.
  - Idempotent : 2e clôture de la même semaine = update propre du même onglet.

- **Module `firebase/functions/lib/week-iso.mjs`** : helper partagé extrait (`weekIsoNumber`, `weekIsoLabel`, `snapshotSheetTitle`). Réduit la triplication backend (dashboard-core.mjs + index.js + ce nouveau module).

- **Intégration** dans `cloturerSemaine` (manuelle) + `clotureHebdo` (cron étape 1) : try/catch englobant, ne fait JAMAIS échouer la clôture. `clotureHebdo` a reçu `secrets: [DASHBOARD_SA_KEY]` (nécessaire pour `getSheetsClient()`).

- **Script `firebase/functions/scripts/backfill-snapshot-sheet-semaine-w20.mjs`** : génère rétroactivement l'onglet pour la semaine du 11/05 déjà clôturée.

- **Fix titre** : `snapshotSheetTitle` utilisait `dateFin` du doc Firestore (dim 23:59:59.998Z UTC = 18/05 00:00 Paris) → titre affichait `(11-18 mai)` au lieu de `(11-17 mai)`. Fix : recalculer le dimanche depuis weekKey du lundi + 6 jours à midi local.

- **Fix filtre ventes** : initialement filtre `!cachee && source==='discord' && !annulee` ne retenait que 12 ventes (factures IG dédupliquées) pour la semaine du 11/05 sur 563 totales. Élargi à `!cachee && !annulee` → 322 ventes (manuelles + IG + rattrapage) + colonne "Source" pour distinguer. Patron veut TOUT pour audit IRS.

### Commandes appliquées
```bash
git add -f firebase/functions/lib/week-iso.mjs firebase/functions/lib/snapshot-sheet-semaine.mjs
git add firebase/functions/index.js firebase/functions/scripts/backfill-snapshot-sheet-semaine-w20.mjs public/js/version.js docs/JOURNAL.md docs/ROADMAP.md
firebase deploy --only functions:cloturerSemaine,functions:clotureHebdo,functions:refreshDashboardNow,functions:dashboardKeepAlive,functions:comptaExport,hosting
node firebase/functions/scripts/backfill-snapshot-sheet-semaine-w20.mjs
```

---

## ✅ Session 2026-05-18 (partie 2) — Inspection Sheet + Option B + UX historique semaine

### Contexte
Reprise après interruption partie 1. User a envoyé 5 captures du Sheet Comptabilité (Dashboard, resumé, Depenses, Ventes, Paies). 3 agents parallèles déployés en worktrees isolés + travail sur main.

### Fix formats Google Sheet (onglets `resumé` + `Paies`)
- **Onglet `resumé`** : col `Semaine` affichait `46153` (serial Excel) car `s.numero` = weekKey `2026-05-11` parsé en date par Sheets. Fix : `csvResume()` envoie maintenant `weekIsoLabel(s.numero)` → **`S20 2026`** ; `format-sheet.js` applique en plus `numberFormat @ TEXT` sur col A. Pareil pour les dates (numberFormat `dd/MM/yyyy`), `$` sur cols D-K (CA, bénéfices, masse salariale, primes), col Statut élargie à 150px (anti-troncature `cloturee-manuelle`).
- **Onglet `Paies`** : dates en serial brut `46160,03731` et montants sans `$`. Fix : numberFormat datetime `dd/MM/yyyy HH:mm:ss` sur col A, money `$` sur col D. Bonus : `cleanNomBot()` retire les `<@discordId>` parasites du nom payeur/bénéficiaire ; col `Période` remplie via `weekIsoLabel(p.weekKeyAttribuee)` quand `p.periode` est vide.
- **Header `Prime hebdo`** renommé `(potentielle)` pour clarifier — c'est la prime éligible TTE Art. 4-1.10 (CA ≥ 200k → 5000$), pas la prime effectivement versée.

### Option B — snapshots paie + checkbox Versé (`/rh`)
- Nouveau module `firebase/functions/lib/paie-calc.mjs` qui expose `calculerPaieEstimee()` + `snapshotPaiesEstimees()`. Duplication pragmatique de la logique frontend `utils/paie.js` (commentaire de rappel).
- À chaque clôture (manuelle bouton 🔒 + cron `clotureHebdo` étape 1 lundi 00h00) : snapshot `/paiesEstimees/{weekKey}_{userId}` avec `{userId, weekKey, role, prenom, nom, montantEstime, ca, caParticulier, bidons, caoutchoucs, paye:false, datePaiement:null, paieMatcheeId:null}`. Idempotent par construction (doc ID stable).
- Nouvelle Cloud Function `marquerPaieVersee` (POST, Bearer auth, direction+DRH+admin-tech) : update `paye/datePaiement/paieMatcheeId`. Rules Firestore : read direction+DRH, write `false` (passe par la Function).
- `/rh` : nouvelle colonne **Versé ?** avec checkbox, KPI **Reste à verser**, auto-détection match `/paies` ↔ snapshot (tolérance ±5% ou min 500$), écart visible orange/rouge.
- Script `scripts/backfill-snapshot-paies-w18.mjs` pour rétro-créer les snapshots de la semaine du 11/05 déjà clôturée.

### Dashboard — KPI Bénéfice net cumulé depuis reprise
- Nouveau bandeau full-width entre Subventions/Trésorerie et Conformité TTE : **`📈 BÉNÉFICE NET CUMULÉ — Ce que le LTD a réellement gagné depuis la reprise`**. Vert si positif, rouge si négatif.
- Détail : `X semaines clôturées · CA cumulé X $ · Moyenne X $ / semaine`.
- KPI semaine en cours : wording clarifié pour le user → `"CA − dépenses − salaires versés · déficitaire/positif (%)"` (au lieu du simple `Marge = X %`).
- Historique des semaines : colonne `Semaine` affiche `S20 2026` (via `weekIsoLabel`) au lieu du weekKey brut.
- Bandeau titre : `S20 2026 — du 11/05/2026 au 17/05/2026`.

### Historique des semaines accessible partout
- **Composant factorisé** `public/js/utils/semaine-selector.js` (`initSemaineSelector()`) : dropdown peuplé avec la semaine courante + les N dernières clôturées au format **"Semaine 20 du lundi 11/05 au dimanche 17/05/2026"**. Persistance sessionStorage. Livre un payload `{weekKey, debut, fin, statut, statutLabel, isCurrent, semaine}` au caller.
- **`/ventes`** : sélecteur dans la toolbar. Mode lecture seule sur semaines passées (bouton modifier → 🔒 disabled, tooltip "Semaine clôturée — non modifiable"). Export CSV nommé avec weekKey.
- **`/employee`** : sélecteur dans le panel "Détail de ta semaine". Affiche factures, commission/CA particulier (vendeurs), bidons/caoutchoucs (pompistes) sur la semaine choisie. Listener stations + boutons d'action désactivés sur semaines passées. Marche aussi en mode `?asUser=UID` (direction/DRH inspecte un employé).
- **`/rh`** : remplacement du toggle binaire courante/précédente par le sélecteur complet → permet d'inspecter n'importe quelle semaine clôturée d'un employé. `snapshotMode = !isCurrent`.
- **`period-filter.js`** (utilisé par compta/dashboard/paies/banque/revenus-carburant) : nouvelle option "Semaine dernière" + fonction `injectSemainesHistoriques()` qui injecte un optgroup "📅 Semaines clôturées" avec les N dernières au format long. Plus besoin de passer par "Personnalisé".

### Label semaine ISO uniformisé (S20)
- Nouveau helper `weekIsoNumber(d)` + `weekIsoLabel(weekKey, opts)` dans `formatters.js` (frontend) + dupliqué dans `index.js` et `dashboard-core.mjs` (backend). 3 formats :
  - `'S20 2026'` (court, par défaut)
  - `'S20 2026 (11/05 → 17/05)'` (full)
  - `'Semaine 20 du lundi 11/05 au dimanche 17/05/2026'` (long, pour sélecteurs)
- Le user voulait clarifier : `W18` dans les anciennes notes correspondait à la **semaine du 11/05/2026 = ISO 20**, pas la 18 (raccourci interne mal nommé). Mémoire MAJ pour bannir "W18".

### Version & docs
- `public/js/version.js` : `1.5.0` → **`1.6.0`** (MINOR — nouvelles features visibles).
- Docs guide mis à jour : `01-direction`, `02-drh`, `05-vendeur`, `06-pompiste` (sections historique semaine + colonne Versé).

### Commandes appliquées
```bash
git add -f firebase/functions/lib/paie-calc.mjs
git add firebase/functions/index.js firebase/firestore.rules firebase/functions/lib/dashboard-core.mjs \
        firebase/functions/scripts/format-sheet.js firebase/functions/scripts/backfill-snapshot-paies-w18.mjs \
        public/js/api.js public/js/pages/{rh,ventes,employee}.js public/js/utils/{formatters,period-filter,semaine-selector}.js \
        public/js/version.js public/guide/*.md docs/JOURNAL.md docs/ROADMAP.md
firebase deploy --only functions:cloturerSemaine,functions:clotureHebdo,functions:marquerPaieVersee,functions:comptaExport,functions:refreshDashboardCron,firestore:rules
node firebase/functions/scripts/backfill-snapshot-paies-w18.mjs
node firebase/functions/scripts/format-sheet.js
```

---

## 🚧 Session 2026-05-18 (partie 1) — Clôture manuelle W18 + workflow lundi matin

### Contexte
Premier lundi après mise en service de la plateforme. La semaine W18 (11-17 mai) s'est terminée, le cron auto étape 1 a tourné à 00h00, le patron Blake MARS doit verser les paies et clôturer.

### Option A déployée — toggle "Cette semaine / Semaine précédente" sur `/rh`
- Sélecteur binaire en haut de la page : permet de voir les estimations de la semaine clôturée (à payer) après lundi 00h00 sans perdre les chiffres.
- Badge "À PAYER · 11 mai → 17 mai" + KPI adapté + filtres rôle/statut/recherche conservés.
- Commit `8aa0975`. Doc guide direction + DRH MAJ avec la routine "lundi matin".

### Clôture manuelle (bouton 🔒 /comptabilite) — 4 fix successifs
1. **Fenêtre paie post-dim** (`d991339`) : `cloturerSemaine` ramassait les paies par timestamp strict lun-dim. Aligné sur le cron étape 2 → fenêtre lundi N+1 00h00 → moment du clic. Les paies versées le lundi matin pour W18 sont maintenant capturées dans `masseSalariale`.
2. **Cron étape 2 skip si déjà clôturée manuellement** : préserve les traces `cloturePar`, `noteCloture`, `dateClotureManuelle`.
3. **Wording modal explicite** (`ffb0c38`) : nouveau titre "Clôturer la semaine précédente" + badge vert avec dates exactes (ex "lun 11 mai 2026 → dim 17 mai 2026"), alerte "Pourquoi pas avant dim 23h59" repliable. Le patron voyait "ne peux pas clôturer la semaine en cours" et était confus.
4. **Bug timezone Paris** (`a259805`) : Cloud Functions tournent en UTC. À 01h Paris (UTC+2 été), `getDay()` retournait 0 (dimanche) en UTC et `getHours()` 23 → rejet à tort. Fix : conversion `now` UTC → "horloge Paris" via `Intl.DateTimeFormat` + `toLocaleString('sv-SE', { timeZone: 'Europe/Paris' })`, manipulation des bornes en UTC factice, reconversion en vrai UTC pour Firestore.

### Clôture effective de W18
- Patron Blake MARS a cliqué 🔒 à `18/05/2026 01:24:30 Paris`.
- Doc `/semaines/2026-05-11` : statut `cloturee-manuelle`, note "RAS", CA 266 174 $, masse salariale 97 458 $, bénéfice NET **-793 249 $** (déficit cohérent avec [[reprise S15-17]] + [[dette THORPE 300k$]]).
- 1290 ventes, 116 dépenses, 11 paies ramassées dans la fenêtre.

### Fix pollution KPI semaine en cours — tag paies `weekKeyAttribuee` (`b5f0356`)
- Bug visible sur `/dashboard` : "bénéfice net estimé W19 = -94 399 $" alors que la semaine venait de commencer.
- Cause : `listPaiesSemaine` décalait automatiquement la fenêtre paie ; quand le dashboard demandait W19 avec `dateFin=maintenant (lundi matin)`, le décalage retombait sur la **même journée** = toutes les paies du jour étaient comptées dans W19.
- Fix backend : à la clôture, chaque paie ramassée reçoit `weekKeyAttribuee=weekKey` (W18 en l'occurrence).
- Fix frontend : `listPaiesSemaine` filtre les paies dont `weekKeyAttribuee` est défini ET ≠ semaine demandée.
- Backfill effectué : 11 paies W18 taggées rétroactivement via `scripts/backfill-tag-paies-w18.js`.

### Scripts d'inspection ajoutés
- `scripts/check-cloture-w18.js` : lit le doc `/semaines/{weekKey}` et affiche tous les champs (statut, dates, CA, masse, bénéfice, fenêtre paie).
- `scripts/backfill-tag-paies-w18.js` : tague rétroactivement les paies versées dans la fenêtre paie d'une semaine déjà clôturée.

### 🚧 EN ATTENTE — session interrompue, reprise sur Sheet
Le user a remonté **8 problèmes** sur le Google Sheet "Comptabilité LTD" (`1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY`), captures à venir :
- Ventes/dépenses/paies de W18 devraient passer dans un "dossier semaine d'avant" → Sheet montre toujours W19 vide
- Résumé confus, format semaine calendaire au lieu de RP, dates incompréhensibles
- Statuts à revoir
- Prime hebdo affichée 5000$ à clarifier
- Chiffres pas tous en $
- Doublons format date

Le code générateur : `firebase/functions/lib/dashboard-core.mjs` (909 lignes).

### 🔜 À suivre — Option B (snapshot + checkboxes Versé)
Spec validée :
- À la clôture (manuelle + cron étape 1 auto), snapshot estimations par employé dans `/paiesEstimees/{weekKey}_{userId}` avec champs `paye`, `datePaiement`, `paieMatcheeId`.
- Sur `/rh` "Semaine précédente" : lecture du snapshot (au lieu de recalc live), colonne checkbox **Versé ?**, KPI **Reste à verser**, auto-détection match paie Discord ↔ estimation.

---

## ✅ Session 2026-05-15 (partie 4) — Versioning + signature BLATV + transition rôle Discord

### Versioning et signature
- Nouveau fichier `public/js/version.js` : source unique de vérité pour `VERSION = '1.5.0'` et `AUTHOR = 'BLATV'`. Convention SemVer (MAJOR.MINOR.PATCH).
- Signature affichée à 3 endroits visibles (discrets) :
  - Sidebar bas : `v1.5.0 · by BLATV` (font 0.62rem, opacité 0.5)
  - Footer global sous chaque page : `LTD Sandy Shores · v1.5.0 — by BLATV`
  - README.md : version en tête + crédit en pied
- Meta tags `author` et `version` dans `public/index.html` (SEO, invisible UI).
- Validation visuelle en local via `npx serve public -p 8000` avant push.

### Transition rôle Discord Andrew BEAUCHAMP
- Andrew BEAUCHAMP (compte `lahagragaming93@gmail.com`, rôle site `admin-technique`) passe **citoyen** sur Discord. Décision : se retire du RP côté Discord, garde uniquement la maintenance code du site.
- **Aucun impact technique** : grep complet sur `discord-bot/` et `firebase/functions/` → aucun ID Discord d'Andrew hardcodé. Le bot a son propre token, indépendant des rôles user. Ton compte site reste admin-technique (rôle Firestore, indépendant de Discord).
- Andrew conserve l'accès admin-technique au site (pour maintenance). À terme, quand Blake sera 100% autonome, son compte pourra être supprimé via **Administration → Utilisateurs**.

### Script de diagnostic ajouté
- `scripts/debug-paies-f1.js` : vérifie la chaîne de capture des paies F1 (canal `#paie` → `/paies`) + cross-check anti-doublon avec `/depenses type='paie'`. Confirmé : 2 paies du 11/05 captées proprement, pas de double-comptage.

---

## ✅ Session 2026-05-15 (partie 3) — Filtre période dynamique sur les KPI (5 pages)

**Demande patron** : pouvoir filtrer les KPI du site par période (cette semaine / ce mois / 30 derniers jours / depuis ouverture / personnalisé). Constat initial sur Banque LTD : KPI calculés sur les 500 derniers docs `/banqueLtd` + 500 derniers `/depenses`, soit une période non-déterministe (~6-7 jours au rythme actuel), incompréhensible pour le patron.

### Nouvel util `public/js/utils/period-filter.js`
- `renderPeriodFilter(default)` : renvoie le HTML du `<select>` + bloc dates pour mode personnalisé
- `getPeriode()` / `getPeriodeLabel()` : retourne `{ debut, fin, label }` selon le choix courant (Date | null si "Depuis ouverture")
- `attachPeriodFilter(onChange)` : branche le change handler — change immédiat sur les périodes prédéfinies, clic "Appliquer" pour le mode personnalisé
- 5 périodes : `semaine` (lundi 00h → maintenant), `mois` (1er → maintenant), `30j` (J-30 → maintenant), `ouverture` (pas de borne), `custom` (granularité 1 jour)

### Pages mises à jour
| Page | Détail |
|---|---|
| **Banque LTD** | Filtre + queries `/banqueLtd` et `/depenses` `where timestamp >= debut <= fin` + limit 5000. KPI "Solde actuel" reste live via query séparée (sinon incohérent en mode "période passée"). |
| **Mes paies** | 3 KPI figés (semaine/mois/total) remplacés par un set dynamique sur la période. Filter client-side sur les 200 dernières paies. |
| **Revenus carburant** | Remplace l'ancien sélecteur 7j/30j par le standard (5 options, défaut 30j). Garde le filet REPRISE_DATE (2026-05-09). |
| **Dashboard** | `debut/fin` deviennent dynamiques. Solde banque, alertes, stations, stocks bas → restent live. Historique 6 dernières semaines → reste hebdo. |

### Pages volontairement non-touchées
- **Comptabilité** : centrée sur la semaine RP (primes Art. 4-1.10 hebdo, Art. 4-1.11 mensuelle, déclaration IRS). Sélecteur de semaines archivées déjà présent. Filtre arbitraire risquerait de casser la logique fiscale.
- **Ventes** : real-time listener `listenVentesSemaine` → bascule en fetch one-shot nécessaire (peut être fait plus tard).
- **Employee** (Mon espace) / **RH** : hardwired RP-week pour calcul salaire estimé. Filtre casserait l'objectif "ce que je touche cette semaine".
- **Stations** : KPI = état instantané (stocks, alertes), pas temporels.

### Script de diagnostic
- `scripts/debug-banque-kpis.js` : reproduit le calcul des KPI Banque côté serveur pour vérifier la période exacte couverte. Réutilisable.

---

## ✅ Session 2026-05-15 (partie 2) — Refresh complet doc compta + habillage 4 feuilles + badge fournisseur

**Contexte** : après reclassement de 2 factures matière 1ère côté site, le patron constate que rien ne bouge dans le doc compta (Sheet). Diagnostic remonte au cache `IMPORTDATA` de Sheets (~1h) qui bloquait toute remontée Firestore → Sheet.

### Fix cache IMPORTDATA — refresh complet en 1 clic
- Nouveau module `firebase/functions/lib/refresh-importdata.mjs` exporte `forceRefreshImportData({ sheets })` : scanne A1:Z5 de chaque feuille, trouve les formules `IMPORTDATA(...)`, ajoute/met-à-jour un query param `&_t={timestamp}` → Sheets considère l'URL comme nouvelle et re-fetch immédiatement.
- Branché dans `refreshDashboardNow` (bouton Compta) et `cloturerSemaine`. Pas dans `dashboardKeepAlive` every-minute (trop agressif sur API Sheets).
- Renommage UI : bouton `🔄 Rafraîchir Dashboard Sheet` → `🔄 Rafraîchir doc comptabilité` (le bouton refresh maintenant TOUT le doc, pas que le Dashboard).

### Habillage des 4 feuilles data (`format-sheet.js` étendu)
- Header rouge sang + texte blanc bold + freeze ligne 1 (déjà existant)
- **Bordures grille** : cadre extérieur `#4d4d4d` (SOLID_MEDIUM) + grille intérieure `#bfbfbf`
- **Auto-resize lignes** : remplace l'ancienne hauteur fixe 30px → ajustement à la hauteur du contenu wrappé (plus de troncature sur Justification)
- **Format monétaire** sur colonne Montant : `25 000 $` + alignement droite
- **Format date** `dd/MM/yyyy HH:mm:ss` sur colonne Date + largeur 150px (nécessite passage au format ISO côté CSV, cf. ci-dessous)
- **Couleurs conditionnelles sur `Depenses`** : 🟢 vert pâle `#e1f5e1` si Déductible=oui, 🔴 rouge pâle `#ffe5e5` si Déductible=non
- **Zebra ivoire/blanc** (banding) sur `Ventes`, `Paies`, `resumé` (banding non appliqué sur Depenses pour ne pas écraser le conditionnel)
- Idempotent : `deleteBanding` + `deleteConditionalFormatRule` avant ré-application

### Format date ISO côté serveur (`comptaExport.dateIso`)
- Passage de `"14/05/2026 22h23:17"` (texte volontairement non-date pour Sheets) → `"2026-05-14 22:23:17"` (ISO reconnu comme datetime)
- Permet à Sheets d'appliquer le `numberFormat` date + tri/filtres date intelligents
- `comptaExport` redéployé

### Bug badge fournisseur côté UI Compta
- `reclasserDepense` ne posait pas `fournisseurLabel` sur la dépense après mémorisation d'un pattern → la colonne Fournisseur restait `—` côté site, alors que comptaExport refait le match à la lecture pour le CSV/Sheet
- Fix : ajout d'un **re-match systématique** après save (avec ou sans mémorisation) : lit `/config/global.fournisseurs` à jour, applique `matchesFournisseurPattern`, pose `fournisseurLabel` + `fournisseurPatternId` si match, sinon supprime les anciennes valeurs
- Script `backfill-fournisseur-label.js` créé : reposeer `fournisseurLabel` sur toutes les dépenses passées qui matchent un pattern. Backfill initial → 2 dépenses 265 → Yootool ✓

### Tests fonctionnels
- 2 factures matière 1ère (1915883, 1915942) reclassées côté site → visibles instantanément sur le Sheet en `matieres-premieres` ✅ déductible 🔒 validé 🟢 vert pâle
- 2 achats boutique 265 reclassés en Yootool → badge fournisseur visible côté UI Compta après backfill ✅

### Cloud Functions redéployées
- `refreshDashboardNow` (ajout `forceRefreshImportData`)
- `cloturerSemaine` (ajout `forceRefreshImportData`)
- `comptaExport` (format date ISO)
- `reclasserDepense` (re-match fournisseur après save)

### Cleanup scripts (post-debug session)
- Supprimés : `debug-depenses-headers.js`, `debug-importdata-formulas.js`, `test-force-refresh.js` (one-shot)
- Gardés : `format-sheet.js`, `force-refresh-dashboard.js`, `force-refresh-sheet.js`, `debug-sheet-content.js`, `backfill-fournisseur-label.js` (réutilisables)

---

## ✅ Session 2026-05-15 — Dashboard Sheet pro + Engagements + Cleanup

**Demandes patron successives** :

### Dashboard Google Sheet — refonte pro pilotée par Node.js
1. **Section Subventions & Trésorerie** ajoutée (3 KPIs : reçues / banque / opérationnel)
2. **Section Engagements de remboursement** ajoutée (tableau avec compteur jours restants + statuts couleur)
3. **Section Conformité TTE** simplifiée (3 lignes : masse salariale + déclaration + paiement impôts, statut dynamique selon jour de la semaine)
4. **Footer Audit IRS** réduit (2 lignes discrètes au lieu de 6 noires flashy)
5. **Heure timezone Paris** corrigée (`toLocaleString({ timeZone: 'Europe/Paris' })`)
6. **Centrage des données** dans Dashboard + onglets Depenses/Ventes/Paies (sauf Raison/Justification = gauche)
7. **Onglet Ventes filtré** : uniquement factures IG (source=discord, non annulées), 1 seul N° par ligne (N° Facture IG), pas de bénéfice
8. **Colonne Raison du Dashboard** : affiche `fournisseurLabel` (HDM) au lieu du N° technique facture

### Cloud Functions Dashboard
- `refaire-dashboard-pro.js` (CLI) refacto en `lib/dashboard-core.mjs` exportable
- `refreshDashboardNow` (HTTP onRequest, auth direction) — bouton 🔄 page Compta
- `cloturerSemaine` (HTTP onRequest, auth direction) — bouton 🔒 page Compta avec confirmation IRS + verif date dimanche 23h59+
- `dashboardKeepAlive` (cron every 1 minute) — check intégrité cellule A1 + restaure SI écrasé par Apps Script (sinon skip silencieux)
- Suppression du cron `refreshDashboardCron` (every minute invasif visuellement)
- Service account Firebase partagé en Éditeur sur le Sheet par le patron
- Secret `DASHBOARD_SA_KEY` stocké via `firebase functions:secrets:set` (clé JSON du SA)

### Bénéfice auto direction
- Dans `onFacture` : si vendeur direction/responsable-vente, calcul bénéfice depuis items + prixAchat
- Parser `facture.js` enrichi : capte 2 patterns d'items ("Nx Item" et "Item xN")
- Système d'aliases sur produits : `aliases: ['eau purifier', 'EAU PURIFIER', ...]` (script `maj-produits-alias.js`)
- Eau Purifier : `pourPro: true` (revente pros, 0.5$/1.25$, bénéfice 0.75$/unité)
- Bouteille d'eau : `pourPro: false` (vente particulier comptoir, commissionnable vendeurs)

### Engagements de remboursement
- Collection `/engagements` avec contrat Abraham THORPE (300 000$ essence à rembourser avant 11/06/2026, contrat total 790k$ dont Brickadeta+Jogger non remboursables, Pounder 3 refusé)
- Cloud Function `gererEngagement` (HTTP, auth direction) : CRUD complet (list/create/update/delete/rembourser)
- Auto-détection remboursement dans `onDepense` (raison contient "remboursement subvention/essence/dette") → décrémente montantRestant
- Cron quotidien `cronAlertesEngagements` à 9h Paris : alerte ⚠ 7j avant échéance, 🔴 critical + statut='defaillant' si retard
- Section Admin "📋 Engagements de remboursement" : tableau + modale CRUD + modale remboursement manuel + historique

### Fraude potentielle Teodomiro
- Fix bug critique `onFacture` : dédup ne re-lie plus une déclaration manuelle déjà utilisée à plusieurs factures bot
- Script `debloquer-teodomiro.js` pour décacher les 2 factures faussement dédupliquées (1915402, 1915409)
- Logique : (a) match explicite via `factureBotRef==p.factureId`, (b) match implicite legacy seulement si manuelle pas déjà liée

### Compta — autres améliorations
- Onglet Ventes : retire colonne Bénéfice (info interne, pas pour contrôleur IRS)
- Onglet Ventes : retire les déclarations manuelles (`source !== 'manuelle'`), affiche que les factures IG
- Section Engagements Dashboard : statuts couleur (🟢 OK > 7j / 🟠 ≤ 7j / 🔴 RETARD)
- Patron bouton "Clôturer semaine" verif côté serveur (date après dimanche 23h59 + confirmation IRS)

### Cleanup repo
- Suppression `discord-bot/peek-*.json` (4 fichiers dump debug)
- Suppression `discord-bot/peek-tous-canaux.md` (inventaire debug)
- Suppression `discord-bot/scripts/peek-channel.js`, `peek-tous-canaux.js` (debug)
- Suppression `firebase/functions/scripts/activer-api-apps-script.js`, `maj-apps-script-via-api.js` (échec API user-context)
- Suppression `backup-2026-05-14-02-1204.json` (snapshot manuel, non versionné)
- `.gitignore` déjà à jour (couvre backup-*, peek-*)

### Mémoires sauvegardées
- `projet_subvention_thorpe_2026_05_14.md` (contrat IRS Abraham THORPE)
- `references_tte_charges_deductibles.md`, `references_tte_salaires_primes.md`, `references_tte_impots_sanctions.md`, `references_tte_guide_site.md` (TTE complet en 12 chapitres)
- `feedback_tte_decision_patron.md` (classification déductible = manuelle, jamais auto)
- `references_deductibilite_ltd.md` (mapping fournisseurs + règles dédu confirmées)
- Mise à jour de `references_canaux_discord_logs.md` à voir lors des prochains canaux

**Cloud Functions actives** :
- `botIngest` (Discord → Firestore)
- `refreshDashboardNow`, `cloturerSemaine`, `gererEngagement` (HTTP direction)
- `dashboardKeepAlive`, `cronAlertesEngagements`, `clotureHebdo`, `clotureHebdoPaies` (cron)
- `declarerVente`, `modifierVente`, `reclasserDepense`, `pompisteRavitaillerManuel`, `pompisteCorrigerStock`, `pompisteDeclarerCaoutchoucs`, `migrateUsername`, `adminResetPassword`, `comptaExport` (HTTP)

---

## ✅ Session 2026-05-14 (partie 4) — Mapping fournisseurs + auto-classification déductibilité

---

## ✅ Session 2026-05-14 (partie 4) — Mapping fournisseurs + auto-classification déductibilité

**Demande patron** : intégrer les règles TTE concrètes de déductibilité (avocats / matières 1ères / véhicules entreprise / loyer / nourriture / etc.) avec un **mapping par fournisseur** (Yootool=263, Fournisseur LTD=215, HDM, Dynasty 8…) qui auto-suggère la catégorie. Le patron reste décisionnaire final. Pouvoir éditer le mapping côté admin.

**Implémentation** (Phase 1 + Phase 2 inclus) :
1. **Mémoire** : 5 fichiers consolidés sur le TTE (charges déductibles, salaires-primes, impôts-sanctions, décision patron, mapping fournisseurs LTD)
2. **`/config/global.fournisseurs`** : nouvelle structure array de patterns `{ id, label, matchType (boutique-id|facture-id|raison-regex|compte-cible), matchValue, categorie, deductible, raisonClassification }`
3. **Parser bot `depense.js`** : extrait `boutiqueId` et `factureId` depuis la raison
4. **Handler `onDepense`** : lookup mapping fournisseurs → si match, suggère catégorie + déductibilité + mémorise `fournisseurLabel` ; sinon fallback legacy regex ; si rien → `type='a-classifier'`
5. **Cloud Function `reclasserDepense`** : auth direction, override catégorie/déductibilité + option `memoriserPattern` pour ajouter un nouveau fournisseur à la config
6. **UI Compta** : nouvelle table avec colonnes Fournisseur + statut validation (🔒 / 💡 / ⚠) + bouton 🔄 + modale de reclassification avec checkbox "Mémoriser"
7. **Page Admin** : panneau "🏷 Mapping fournisseurs" CRUD complet (liste / ajout / édition / suppression patterns)
8. **CSV `comptaExport`** : 4 nouvelles colonnes (Fournisseur, Validé par patron, Justification, en plus de Date/Raison/Montant/Type/Déductible/Utilisateur)
9. **Script `init-fournisseurs-mapping.js`** : seed des 5 patterns initiaux (Yootool, Fournisseur LTD, HDM, Dynasty 8, Achat essence)
10. **Script `backfill-classification-depenses.js`** : reclasse les dépenses existantes selon le mapping, fait la cross-réf historique compte cible, liste celles "à classifier manuellement". `--since` par défaut à 2026-05-09 (ouverture LTD)
11. **Phase 2 — Cross-réf compte cible bidirectionnelle** :
    - Parser `xbankaccount.js` capte aussi `fromPropername`, `toPropername`, `fromName`, `toName`, `fromDiscord`, `toDiscord`
    - Handler `onBankAccount` stocke ces champs dans `/banqueLtd` + appelle `crossRefBanqueDepense` pour enrichir une dépense correspondante (même montant, ±90s) après coup
    - Handler `onDepense` appelle `lookupCompteCibleDepuisBanque` AVANT le lookup mapping pour récupérer `compteCibleNom` (si removemoney déjà arrivé)
    - `matchesFournisseurPattern` supporte `matchType: 'compte-cible'` (substring match insensible casse)
    - HDM et Dynasty 8 désormais auto-identifiés dès qu'une facture est payée vers ces destinataires

**Fichiers modifiés/créés** :
- `discord-bot/parsers/depense.js` : extraction boutiqueId/factureId
- `discord-bot/parsers/xbankaccount.js` : capture from/to (Discord/Name/Propername)
- `firebase/functions/index.js` : `onDepense` enrichi + `matchesFournisseurPattern` + `reclasserDepense` + `csvDepenses` enrichi + `onBankAccount` étendu + `crossRefBanqueDepense` + `lookupCompteCibleDepuisBanque`
- `firebase/functions/scripts/init-fournisseurs-mapping.js` (nouveau)
- `firebase/functions/scripts/backfill-classification-depenses.js` (nouveau, avec cross-réf historique)
- `public/js/pages/comptabilite.js` : table + modale reclasser + affichage compte cible
- `public/js/pages/admin.js` : CRUD mapping fournisseurs (4 matchTypes)
- `public/guide/09-comptabilite.md` : section 5 "Auto-classification déductibilité"
- `sheets-apps-script.js` : MAJ commentaire description colonnes Depenses

**À faire après push** :
1. Déployer functions (`firebase deploy --only functions:botIngest,functions:reclasserDepense,functions:comptaExport`)
2. Déployer hosting (page Compta + Admin + guide)
3. Redéployer bot Railway (parser depense.js enrichi)
4. Lancer `node scripts/init-fournisseurs-mapping.js --apply` (seeds initiaux)
5. Lancer `node scripts/backfill-classification-depenses.js --apply` (reclasser historique)

---

## ✅ Session 2026-05-14 (partie 3) — Factures annulées IG

**Demande patron** : sur la page perso de Kyle Jackson, 3 factures "à déclarer" alors qu'IG il les a supprimées (clients pas solvables). Vérifier si le bot Discord capte les suppressions et, sinon, permettre de les annuler avec justificatif.

**Découverte** : Faab'Hook émet bien un embed `xbankaccount - cancel` dans `#logs-ig` (fields `logType=cancel`, `category=xbill`, `billId`, `cancellerPropername`, `fromPropername`…) à chaque suppression IG. Le parser `xbankaccount.js` ne traitait que `addmoney`/`removemoney` et ignorait `cancel`.

**Implémentation** (4 volets) :
1. **Nouveau parser** `discord-bot/parsers/factureCancel.js` : filtre `logType=cancel` + `category=xbill`, extrait `billId`, identité de l'annulateur (canceller), du vendeur (from) et du client (to)
2. **Enregistrement** dans `discord-bot/index.js` en tête de `CH_LOGS_IG` (testé avant bankAccount/inventory)
3. **Handler Firebase** `onFactureCancel` : retrouve `/ventes/fac-{billId}`, marque `annulee:true, cachee:true, motifAnnulation, annulateurNom, dateAnnulation`. Idempotent. Si la vente avait déjà été déclarée manuellement (source=manuelle ou remplaceeParId présent) → alerte direction `vente-annulee-apres-declaration` (potentielle fraude : vendeur a encaissé puis annulé IG)
4. **UI RH** (`public/js/pages/rh.js`) : badge `❌ Annulée` avec motif au tooltip dans la table des factures, compteur séparé `X annulée(s) IG` dans le récap
5. **Script backfill** `discord-bot/scripts/rattraper-factures-annulees.js` : scanne les N derniers messages de `#logs-ig`, applique le même marquage sur l'historique. Idempotent.

**Côté employé** : la vente disparaît automatiquement du bloc "📌 Vente in-game à déclarer" (déjà filtré sur `!cachee`). Rien à faire manuellement.

**Fichiers** :
- `discord-bot/parsers/factureCancel.js` (nouveau)
- `discord-bot/index.js` : import + parser ajouté en tête de `CH_LOGS_IG`
- `firebase/functions/index.js` : `case 'factureCancel'` + handler `onFactureCancel`
- `public/js/pages/rh.js` : badge ❌ Annulée + compteur
- `discord-bot/scripts/rattraper-factures-annulees.js` (nouveau)
- `public/guide/05-vendeur.md` : section "Si le client ne peut pas payer"
- `public/guide/07-automatismes.md` : parser factureCancel documenté

**Déploiement** :
1. `cd discord-bot && npm install && railway up` (déploie bot avec nouveau parser)
2. `cd firebase/functions && firebase deploy --only functions:botIngest` (handler cancel)
3. `firebase deploy --only hosting` (UI RH + guide)
4. `cd discord-bot && node scripts/rattraper-factures-annulees.js --apply --limit 2000` (rattrape Kyle + autres)

---

## ✅ Session 2026-05-14 (partie 2) — Salaires + Pompiste UX + Cleanup

**Demandes patron** :
1. DRH = salaire fixe 18 000 $ (plus de "Décider", imposé)
2. Responsable Vente = pro-rata sur CA personnel (formule (CA/40k)×17k, plafond 17k)
3. Responsable Pompiste = inchangé (décidé par patron, max 17k)
4. "Vente fournisseur" → "Vente partenaire" (renommage)
5. Vente partenaire = prix vente auto = 2,1× prix achat (modal live + backfill 33 produits)
6. Espace pompiste = état stations live + décomposition salaire bidons/caoutchoucs
7. Bouton "Déclarer une vente" retiré pour les pompistes (ils ne vendent rien)
8. Modal "Ravitailler" sur Mon espace (select station + saisie litres) — pas besoin d'aller sur Stations
9. Modal "Corriger stock" pour incohérences IG vs site (avec raison + alerte direction)
10. Pompistes ont accès à la page Stations (mode stockOnly)
11. Bug DRH/Blake "0 $" en compta : fix `salaireDecide ?? plafond` ne kick pas sur 0
12. Bug heures Teodomiro : `cumul=0` (index manquant) + service en cours non inclus
13. Suppression compte Jeff TAYLOR (admin-technique) — Firestore + Auth, aucune donnée orpheline

**Fichiers principaux modifiés** :
- `public/js/utils/permissions.js` : `PLAFOND_SALAIRE.drh = 18000`, constantes `DRH_SALAIRE_FIXE`, `CA_PLAFOND_RESP_VENTE`. ACCESS.stations inclut pompistes + DRH.
- `public/js/utils/paie.js` : `salaireResponsableVente(ca)`, `salaireResponsablePompiste(decide)`, `salaireDirection` retourne 18000 fixe pour DRH. Fallback plafond si salaireDecide=0/null.
- `public/js/pages/stocks.js` : "Vente fournisseur" → "Vente partenaire", auto-calc 2,1× live dans la modale (création + édition).
- `public/js/pages/employee.js` : modal Ravitailler (select+litres), modal Corriger stock, bandeau "🟢 En service depuis HHhMM", calculs heures incluent service en cours, décomposition salaire pompiste, état stations live.
- `public/js/pages/comptabilite.js` : renderSalaires + sectionGroupe + récap Discord forcent `DRH_SALAIRE_FIXE` pour DRH, fallback plafond pour patron/co-patron/RP si salaireDecide=0, RV "auto (RH)".
- `public/js/pages/rh.js` : modale détail employé : encart info pour DRH ("fixe imposé") et RV ("calculé auto"), pas de "Décider salaire" pour ces 2 rôles.
- `public/js/pages/stations.js` : auto-ouverture modal caoutchoucs si `#caoutchoucs` dans URL.
- `public/js/api.js` : `listAllServicesEmploye` sans orderBy server-side (tri client, plus d'index requis), nouvelle `getServiceOuvert(uid)`.
- `public/guide/06-pompiste.md` : refonte complète (Ravitailler, Corriger, état stations, valeurs unitaires).
- `public/guide/02-drh.md` + `01-direction.md` : MAJ plafonds (DRH 18k, RV calculé), mode "Voir son espace".

**Cloud Functions déployées** :
- `pompisteRavitaillerManuel` : accepte litres OU bidons (avant : bidons uniquement)
- `pompisteCorrigerStock` (NOUVELLE) : set valeur stock + raison + alerte direction
- `declarerVente` + `botIngest` (déjà déployées partie 1)

**Backfills** :
- 33 produits Vente partenaire ajustés à prixVente = 2,1 × prixAchat
- 20 produits skipés (prixAchat=0 à renseigner manuellement)

**Bugs résolus** :
- Heures de service : index Firestore manquant + service en cours ignoré → `cumul=0` corrigé
- Salaire DRH/Blake `0 $` : fallback `salaireDecide ?? plafond` ne kick pas sur 0 → fix avec `(decide != null && decide > 0)`
- Compte Jeff Taylor (admin-technique) supprimé totalement (Firestore + Auth)

**Backup** : nouveau snapshot 2026-05-14 complet généré, anciennes versions supprimées.

---

## ✅ Session 2026-05-14 (partie 1) — Grand lissage + Quincaillerie + anti-fraude vente

**Demandes patron du jour** :
1. Quincaillerie : créer 8 nouveaux produits crafts + déplacer 4 existants (filet, sac jute, lumière violette, bidon-essence)
2. Onglet "Produit fabrication" renommé **"🔧 Quincaillerie"**
3. Mode "👁 Voir son espace" pour debug employé
4. Anti-fraude vente : déclaration manuelle DOIT correspondre à une facture in-game (montant exact, < 24h)
5. Bloc "sortie non régularisée" retiré de l'espace employé (cloche direction conservée)
6. Avertissements retirés cachés de la liste employé
7. Ventes à déclarer : délai 5 min minimum + exclusion des modifications admin
8. Top 5 produits dashboard : refonte avec podium 🥇🥈🥉
9. Champ "Fournisseur" (Yootool, GB Foundry) avec affichage cross-onglet
10. Distinction `intrant=true` (matières premières non vendues)
11. Grand lissage : backup, suppression scripts jetables, MAJ guide, ROADMAP

**Fichiers principaux modifiés** :
- `public/js/pages/stocks.js` : 5 onglets, modale édition avec select section + fournisseur
- `public/js/pages/employee.js` : mode "Voir comme", filtres ventes 5min, retrait sorties_en_cours
- `public/js/pages/dashboard.js` : Top 5 produits HTML/CSS pur
- `public/js/pages/rh.js` : table factures détail + bouton Voir son espace
- `public/js/utils/vente-modal.js` : sélection facture bot obligatoire pour vendeurs
- `firebase/functions/index.js` : declarerVente exige factureBotId, modifierVente calcule montantParticulier
- `public/js/data/produits.js` : 8 nouveaux produits + flags intrant/enFabrication/fournisseur
- `public/css/western.css` : styles `.btn-tab`, `.top-produit-row`, podium

**Nettoyage** :
- 32 scripts one-shot supprimés de `firebase/functions/scripts/` (gardé 11 utilitaires génériques)
- `docs/05-guide-utilisation.md` supprimé (doublon avec public/guide/)
- Fichiers racine obsolètes supprimés (ancien backup, prompt initial)
- Code mort retiré : `chartTop`, listener sorties_en_cours côté employé, imports inutilisés

**Backup** : `backup-2026-05-14-00-3004.json` (3,2 Mo, 24 collections, 9678 docs, 19 users Auth)

**ROADMAP** : nouveau fichier `docs/ROADMAP.md` créé avec les chantiers en suspens.

---

## ✅ Session 2026-05-13 — Stocks en 5 onglets + flag intrant

**Demande patron** : restructurer la page Stocks épicerie en 4 sections distinctes accessibles par onglets (pas de scroll) :
1. 🛒 Vente épicerie — particuliers (commission vendeur)
2. 🏢 Vente fournisseur — pros (CA LTD)
3. 📦 Achat fournisseur — matières premières (achetées, non revendues)
4. 🔧 Produits de fabrication (issus du craft, à venir)

Puis demande complémentaire : 5e onglet 📜 Mouvements de stock (qui était en panel séparé en bas).

**Implémentation** :
- `public/js/data/produits.js` : flag `intrant: true` sur acier, cuivre, caoutchouc, corde, feve-cacao. Flag `enFabrication` prévu mais aucun produit actuel ne l'a (en attente du go craft).
- `public/js/pages/stocks.js` :
  - 5 onglets en haut (`btn-tab`), avec compteurs par section
  - 1 seul panel affiché à la fois selon l'onglet actif (`sectionActive`)
  - Fonction `sectionProduit(p)` détermine la section unique d'un produit : enFabrication > intrant > pourPro > vente_epicerie
  - Filtres (catégorie / niveau / recherche) appliqués sur la section active
  - Onglet "Mouvements" : cache le panel stocks + filtres, affiche le panel mouvements (lazy load)
  - Modale création/édition : select avec 4 sections au lieu de checkbox pourPro
- `public/css/western.css` : nouveau style `.btn-tab` / `.btn-tab.active` (rouge LTD)
- `public/js/utils/vente-modal.js` : exclut TOUJOURS les intrants (peu importe le rôle). Vendeur ne voit que !pourPro + !intrant. Direction voit !intrant.
- Backfill Firestore : 5 produits intrant=true (acier, cuivre, caoutchouc, corde, feve-cacao)

**Pourquoi cette structure** :
- Les matières premières (acier, cuivre, etc.) ne doivent jamais être vendues — flag `intrant` les sort des modal vente définitivement
- Les futurs produits craftables auront une section dédiée pour ne pas se mélanger aux produits achetés-revendus standards
- L'onglet Mouvements remplace l'ancien panel en bas de page → moins de scroll

**Rappels en attente du go patron** :
- 6+ produits craftables à créer (Visseries, Pioche, Jerrican, Plomberie, Câble électrique, Charbon, Bobine, Tissu) — voir `reminders_a_clarifier_craft.md` en mémoire interne
- Prix acier (40 $) à actualiser quand GB Foundry rouvre, cuivre à fixer
- Bidon vide, Tissu, prix Lumière violette : à revoir à l'ouverture du craft

---

## ✅ Session 2026-05-13 — Distinction produits particulier / professionnel

**Demande patron** : le LTD vend à deux canaux :
- **Particuliers** : les vendeurs déclarent leurs ventes manuellement → commission
- **Professionnels** : direction/DRH/Resp Vente vendent en gros (matières premières, eau purifiée, etc.) → CA LTD mais pas de commission vendeur

**Implémentation** :
- `public/js/data/produits.js` : flag `pourPro` sur chaque produit. 26 produits = `false` (particulier), 66 = `true` (pro)
- `public/js/pages/stocks.js` : split du tableau en 2 panels distincts (Vente LTD vs Vente fournisseur). Toggle "pourPro" dans modal édition/création. Stock négatif mis en évidence (badge ⚠ rouge). Décimaux supportés (step 0.01) + affichage `moneyPrecis` pour permettre les prix tels que 1,25 $
- `public/js/utils/vente-modal.js` : filtre les produits visibles selon le `role` du caller. Vendeur ne voit que pourPro=false. Direction voit tout
- `public/js/pages/employee.js` : passe `profile.role` à la modal vente
- `firebase/functions/index.js` : `declarerVente`, `modifierVente`, `onFacture` calculent et stockent `montantParticulier` sur chaque /ventes (pro-rata si vente mixte)
- `public/js/utils/paie.js` : `salaireVendeur(role, caGenere)` reste inchangé — c'est l'appelant qui passe `caParticulier` au lieu de `ca`
- Pages `rh.js`, `comptabilite.js`, `dashboard.js`, `employee.js` : utilisent `montantParticulier ?? montant` (fallback historique) pour le calcul du salaire
- Mon espace : 4 KPIs distincts (CA total / CA commissionnable / Quota / Salaire estimé) + badges PRO dans la modal vente
- RH : détail employé montre CA total + CA particulier + CA pro séparément

**Backfill** :
- `scripts/init-pourpro.js` : 92 produits Firestore mis à jour
- `scripts/backfill-montant-particulier.js` : 107 ventes des 30 derniers jours recalculées (98,1% en particulier, 800 $ CA pro identifiés)

**Bug stock cola-zero connu** : 351 unités d'écart entre cumul mouvements et stock affiché. Cause = bot Discord ne loggue pas `inventory-remove` pour cet item (mapping FiveM manquant). Workaround actuel : ajustements manuels. À traiter dans une session dédiée.

---

## ✅ Session 2026-05-13 — Anti-doublon facture bot vs déclaration manuelle

**Problème** : quand un vendeur déclare une vente manuellement, le bot Discord remonte aussi la même facture (avant ou après, selon latence). Résultat : 2 lignes pour 1 vente réelle dans Mon espace / Ventes / RH / Compta.

**Implémentation** :
- `declarerVente` : après création, marque `cachee:true` sur la vente bot correspondante (15 min avant, même vendeur+montant)
- `botIngest/onFacture` : à la création d'une facture bot, check si manuelle correspondante existe → crée directement avec `cachee:true`
- `public/js/api.js` : `listVentesSemaine` + `listenVentesSemaine` filtrent `v.cachee` automatiquement pour toutes les pages
- `scripts/backfill-doublons-bot-manuelle.js` : 5 doublons historiques cachés (Noé Varga ×2, Kyle Jackson, Ilyes Chaifi ×2)

Audit préservé via les champs `cachee`, `remplaceeParId`, `remplaceeParFactureId`, `dateCachage`.

---

## ✅ Session 2026-05-13 — Salaire vendeur calculé sur CA × commission

**Demande patron** : le calcul actuel donnait Teodomiro à 1 316 $ pour 9 412 $ de CA en S20. Le patron veut la règle simple `CA × commission` (32,5 / 35 / 37,5 %), pas `bénéfice × commission`. Avec l'ancienne formule, le plafond salaire (13k / 14k / 15k $) était inatteignable vu une marge moyenne de ~43 % sur l'épicerie. Avec la nouvelle, le calibrage est aligné : atteindre 40 000 $ de CA = atteindre exactement le plafond du grade.

**Fichiers modifiés** :
- `public/js/utils/paie.js` : `salaireVendeur(role, caGenere)` — `caRetenu = min(caGenere, 40000)`, `salaire = min(caRetenu × commission, plafond)`. Signature simplifiée (paramètre `beneficeTotal` supprimé)
- `public/js/utils/paie.js` ligne 71 : `salaireEstime` ne passe plus `beneficeGenere`
- `public/js/pages/employee.js` ligne 91 : appel `salaireVendeur(role, ca)` (sans bénéfice)
- `public/guide/05-vendeur.md` : formule + 3 exemples + section "maximiser ta paie" + FAQ
- `public/guide/02-drh.md` : formule + 2 exemples calibrage plafond
- `public/guide/08-faq-depannage.md` : FAQ salaire bas / plafond CA
- `public/guide/01-direction.md` + `public/guide/03-responsable-vente.md` : note "prix d'achat = compta, pas commission"

**Impact** : masse salariale vendeurs ~2× plus élevée à CA équivalent. À surveiller vis-à-vis du ratio TTE 90 % (mais en pratique les vendeurs étaient sous-payés vs l'intention initiale du calibrage 40k → plafond).

**Bénéfice (prix d'achat)** : continue d'être affiché et sert au bénéfice net en compta + aux marges produit ; n'impacte plus la commission vendeur.

**Déploiement** : site re-poussé sur GitHub Pages.

---

## ✅ Session 2026-05-13 — DRH peut modifier les stocks (alignement Direction)

**Demande patron** : le DRH doit avoir les mêmes droits que Patron / Co-Patron / Admin Technique pour modifier les stocks (épicerie + essence).

**Contexte** : depuis 2026-05-11, le DRH ne pouvait plus modifier les stocks épicerie (restriction posée pour audit inventaire hebdo physique). Il ne pouvait pas non plus modifier les stations essence (`fullEdit` réservé à direction + admin-technique). Le patron revient sur ces deux restrictions.

**Fichiers modifiés** :
- `public/js/pages/stocks.js` ligne 22 : `editable` inclut désormais `'drh'`
- `public/js/pages/stations.js` ligne 20 : `fullEdit` inclut désormais `'drh'` (peut ajouter/supprimer station, modifier prix/capacité/stock/N° pompe)
- `firebase/firestore.rules` : ajout `isDRH()` en écriture sur `/stations`, `/redistributions`, `/declarationsCaoutchouc`
- `public/guide/02-drh.md` : tableau modules + section "Ce que tu peux AUSSI faire" mis à jour pour refléter les stocks essence

**Non touché (volontairement)** :
- `comptabilite_edit` reste exclusif à Direction + admin-technique (audit financier — pas dans la demande)
- Le Responsable Vente reste exclu de la modification des stocks épicerie (la restriction 2026-05-11 le concernait aussi, et le patron n'a parlé que du DRH)

**Déploiement** : rules Firestore redéployées (`firebase deploy --only firestore:rules`), site re-déployé.

---

## 🎯 À FAIRE PROCHAINE SESSION — Auth sans email (immersion RP)

**Demande du patron 2026-05-11** : retirer complètement les emails du flow auth. Argument : "c'est intrusif pour l'immersion". Spec détaillée :

### Comportement cible
1. **Création compte** (admin uniquement) :
   - Le patron / co-patronne ouvre `/admin` → bouton "Créer un compte"
   - Modal : champs `prénom`, `nom`, `rôle`, `username` (string libre). **Pas de champ email.**
   - Le système génère un **mot de passe aléatoire** (8-10 char alphanumeric)
   - Le mot de passe est affiché dans un toast/modal au patron (à transmettre au RP via Discord)
   - Le compte est créé avec `mustChangePassword: true`

2. **Connexion** :
   - Formulaire : `username` + `password` (plus d'email visible)
   - Si `mustChangePassword === true` → écran forcé "Choisis ton mot de passe permanent" (≥8 char)
   - Une fois changé : `mustChangePassword: false` + redirect vers la page d'accueil par rôle

3. **Reset password** (admin uniquement) :
   - Le patron ouvre la fiche d'un employé dans `/admin` → bouton "Régénérer mot de passe"
   - Nouveau MDP aléatoire affiché au patron + `mustChangePassword: true` reset à true
   - Au prochain login de l'employé, il devra à nouveau choisir un MDP

### Implémentation technique
**Firebase Auth a besoin d'un email**. Solution : email "interne" fabriqué = `${username}@ltd-sandy-shores.local`. Jamais affiché à l'utilisateur. Le username est l'identifiant visible partout.

**Fichiers à modifier** :
- `public/index.html` ou `signin.html` : remplacer input email par username, ajouter écran "force password change"
- `public/js/auth.js` : `signIn(username, password)` qui appelle `signInWithEmailAndPassword(auth, ${username}@ltd-sandy-shores.local, password)`. Lire profile, si `mustChangePassword` → redirect vers screen change-password (bloquant)
- `public/js/pages/admin.js` : formulaire création/edition utilisateur — retirer email, ajouter username, ajouter bouton "Régénérer MDP"
- `firebase/functions/index.js` : nouvelles Cloud Functions HTTP `createUserWithUsername(payload)` et `regeneratePassword(uid)` callable depuis le client admin. Utilise Admin SDK (auth.createUser + auth.updateUser). Vérifie le caller est isDirection.
- `public/js/api.js` : wrappers pour les 2 nouvelles Cloud Functions
- `firestore.rules` : `mustChangePassword` accessible uniquement à l'admin + au user lui-même
- `users` schema : ajouter `username` (string, unique), `mustChangePassword` (boolean), retirer affichage `email` partout
- Migration utilisateurs existants : script one-shot qui ajoute `username` (= prefix avant @ dans current email) + `mustChangePassword: false`

**Pièges identifiés** :
- Username unicity : check côté admin avant création + index Firestore
- Firebase Auth ne permet pas de changer l'email associé sans reauth → si on veut un username post-creation, c'est OK car l'email interne est `${username}@ltd-sandy-shores.local` figé
- Le password change flow doit être bloquant (pas de skip via fermeture modal). Implémenter via redirection forcée au lieu de modal
- L'admin Firebase Auth peut updatePassword sans reauth → utiliser ça pour le reset

**Estimation effort** : 3-4h de dev. Tester en local avant push.

---

## ✅ Session 2026-05-10/11 (partie 5) — Factures #factures + permissions Pompiste + retrait GitHub

### 1. Factures Jessica via #factures (symetrique aux ventes carburant)
Comme `#suivi-achat-essence`, le canal `#suivi-facture` est silencieux post-migration. Les factures arrivent maintenant via **`#factures`** (id 1441586772403294359) en RAW logsBruts seulement → aucune n'apparaissait dans `/ventes`.

Fix (commit `0e481c1`) :
- `discord-bot/index.js` : `#factures` déplacé de RAW_CHANNELS vers CHANNEL_MAP avec `parseFactureEmbed` (même format que `#suivi-facture`)
- `onFacture` Firebase Function : remplace `add()` par `setDoc('fac-${factureId}')` → **idempotent**. Dédupe automatique si même facture émise via les 2 canaux.
- Script `rattraper-factures.js` exécuté : 2 factures backfillées (N°1907650 + N°1906893).

### 2. Permission Pompiste sur modal /stations (commit `b17720b`)
**Avant** : `editable = isDirection || responsable-pompiste` → ces 2 rôles avaient accès total (changer prix, capacité, supprimer station, N° pompe).

**Maintenant** :
- **fullEdit** = `isDirection || isSuperAdmin` (Patron, Co-Patron, Admin Technique) → tout modifiable + Ajouter + Configuration + Supprimer
- **stockOnly** = `responsable-pompiste || isPompiste` → **uniquement `stockActuel`** dans la modal (les autres champs : Nom, capacité, seuil, prix, N° pompe sont `disabled`). Bouton Supprimer + Ajouter + Configuration cachés. Alert info dans la modal explique le verrouillage.

Use case : un pompiste qui ravitaille une station peut maintenant ajuster le stockActuel via le site (puisque le canal `#suivi-déclaration-quota-essence` n'est pas accessible au bot pour détecter les refills auto).

### 3. Suppression toutes mentions GitHub côté site public (commit `b17720b`)
**Argument du patron** : les employés auront seulement l'URL du site sur leur tablette in-game, ils n'auront jamais accès au code source. Retirer les liens GitHub évite le vol du projet par un employé curieux.

Fichiers nettoyés :
- `public/js/pages/guide.js` : bouton "📂 Voir sur GitHub" + REPO_BLOB + handlers supprimés
- `public/guide/00-index.md` : URL github.io remplacée par "demande URL à la direction"
- `public/guide/07-automatismes.md` : refs GitHub Pages neutralisées
- `public/guide/08-faq-depannage.md` : githubstatus retiré + bloc "statut services externes" supprimé (révélait Firebase/Railway/GitHub Pages)
- `public/guide/09-comptabilite.md` : URLs absolues vers github.io retirées
- `public/js/firebase-config.js` : commentaire neutralisé

Note : le repo reste public sur GitHub (GitHub Pages payant pour repos privés). Stratégie défense en profondeur : (1) ne pas donner le lien aux employés, (2) auth Firebase + rules Firestore restent la vraie barrière.

---

## ✅ Session 2026-05-10/11 (partie 4) — Pipeline ventes carburant post-migration + décrément stockActuel

### 1. Diagnostic : #suivi-achat-essence est mort
Depuis la migration FiveM (~05/2026), le canal `#suivi-achat-essence` ne reçoit plus rien. Les ventes carburant transitent maintenant par `#logs-ig` (parser `xbankaccount`) avec raison `Redistribution N°XXXXX`. Le N° = ID de la pompe in-game.

### 2. Mapping pompes FiveM ↔ stations
Inféré depuis les anciens embeds `#suivi-achat-essence` archivés (parser lisait "Redistribution N°16060 — Panorama Drive..." donc N°↔station étaient côte à côte). 8 mappings identifiés, stockés dans `/config.fivemPompesMap` :
- 15877→Route 68 LTD, **16060→Panorama**, **16426→Algonquin**, 16428→Route 68, 16488→Clinton, 16513→Palomino, 16535→Senora, **35489→Cholla**
- Pompe **30358** orpheline (8 docs anciens, station inconnue)
- Modal `/stations` étendue : nouveau champ "N° pompe FiveM" qui synchronise `/stations/{id}.fivemPompeId` + reverse-map `/config.fivemPompesMap`

⚠️ Pendant la session, le patron a suggéré 2 swaps (Cholla↔Senora puis Algonquin↔Palomino) qui se sont révélés erronés — le diagnostic post-cutoff (quelles pompes ont des ventes récentes = pompes actives) a confirmé que **l'inférence originale était correcte**. Trust historic data over verbal swap suggestions if conflict.

### 3. Décrément auto stockActuel via `onBankAccount`
Avant : aucune décrémentation. Le parser `stationsDashboard` écrasait périodiquement `stockActuel` avec des valeurs stale du dashboard in-game (Palomino 4855L alors que vide en jeu).

Fix structurel (commit `433ce54`) :
- `onBankAccount` détecte "Redistribution N°XXXXX" → lit `prixLitre` station → `litres = montant/prix` → décrémente `stockActuel` en **transaction atomique** + crée doc `/redistributions` enrichi (litres, stockAvant, stockApres, prixLitre snapshot)
- `onStationsDashboard` **n'écrit plus** `stockActuel` (garde stockMax/prixLitre/derniereRavit/statut)
- `onRapportPompiste` **n'écrit plus** `stockActuel` (garde uniquement le doc audit)

**Source de vérité `stockActuel`** désormais : baseline manuel (modal `/stations` ou script) + décrément auto sur vente. Les ravitaillements doivent être saisis manuellement (le bot n'a pas accès au canal `#suivi-déclaration-quota-essence`).

### 4. CA carburant intégré dans calculs globaux
Les ventes carburant n'étaient comptabilisées nulle part dans le CA. Correction (commit `fb6ee48`) :
- `dashboard.js` : nouveau KPI "⛽ CA carburant" à côté de "CA semaine". Le bénéfice net et ratio masse salariale (TTE) utilisent `caTotal = caProduits + caCarburant`
- `comptabilite.js` : KPI "💚 CA produits" + "⛽ CA carburant" séparés. Tableau recettes détaille 2 lignes. Gauge TTE et CSV utilisent caTotal
- `rh.js` : `totalCA` pour `checkMasseSalariale` inclut le carburant (TTE plus représentatif)
- `/ventes` reste séparée (CA produits uniquement) — `/revenus-carburant` reste la page dédiée

### 5. Stocks initiaux 2026-05-10 (3 stations actives)
Baseline du patron : Panorama 2000L, Algonquin 3367L, Cholla 4506L, 5 autres à 0L. Après décrément des 6 ventes post-19:00 UTC : **Panorama 1940L, Algonquin 3332L, Cholla 4477L**. Prix appliqués selon baseline (Panorama 5$, Algonquin/Cholla 4.50$, Palomino 6$, Clinton 5.50$). Seuils d'alerte = 0 (pas de seuil pour le moment).

### 6. ~6500 docs `/redistributions` synchronisés
Plusieurs vagues de correction (mappings successifs) :
- Backfill historique `/banqueLtd` → `/redistributions` (rattraper les ventes pré-deploy)
- Fix stationId sur les rattrapages-revenu (placeholder `station-inconnue-revenu` → vraie station via mapping)
- Re-fix après swap erroné Cholla/Senora puis revert
- Re-fix après swap erroné Algonquin/Palomino puis revert
- Total : ~7500 opérations cumulées, aucune erreur

### 7. Scripts firebase/functions/scripts/ ajoutés
- `init-stations.js` : baseline initial 8 stations
- `backfill-redistributions-from-banque.js` : rattrapage `/banqueLtd` → `/redistributions`
- `fix-pompe-mappings.js` : sync `/config.fivemPompesMap` + `/stations.fivemPompeId`
- `fix-redistributions-stationid.js` : re-applique mapping sur docs existants
- `apply-baseline-with-estimate.js` : reset stocks + estime via ventes post-cutoff
- `check-redistributions-state.js` / `check-stations-state.js` / `diagnose-post-cutoff.js` : diagnostics
- `reset-stocks-vides.js` : helper one-shot

### 8. Commits de la session
`5f05503` Ventes carburant via xbankaccount + mapping pompes — `c6d1e16` Scripts fix mapping — `fb6ee48` CA carburant inclus dashboard/compta/rh — `7e3df02` Swap Cholla/Senora (annulé plus tard) — `26b5829` Baseline + estimation stock — `433ce54` Décrément auto stockActuel, fini les écrasements

---

## ✅ Session 2026-05-10 (partie 3) — UX tableaux + page Revenus carburant

### 1. Helper `utils/sortable-table.js`
Module DOM-based réutilisable (`wrapScroll` + `makeSortable`). Tri par click sur en-tête, indicateurs ▲/▼, MutationObserver pour réappliquer le tri auto après chaque rebuild du tbody. CSS sticky header + scrollbar western. Support `data-sort-value` pour valeur de tri custom (utile quand l'affichage diffère de la valeur réelle, ex: durée formatée mais triée par ms).

### 2. Scroll + tri appliqué sur 9 tableaux de 8 pages
- **stocks** : Inventaire (custom stateful) + Mouvements
- **ventes** : Factures de la semaine
- **comptabilité** : Charges détaillées + Statsbank vs interne
- **rh** : Effectif + Activité
- **banque** : Mouvements bancaires
- **admin** : Comptes utilisateurs
- **paies** : Historique paies reçues
- **decouverte-items** : Items FiveM observés

### 3. Resync complet stocks LTD (74 items, 78 391 unités)
Snapshot manuel des 3 coffres LTD + sous-coffres. Doublons sommés automatiquement (bouteille-eau, creme-fraiche, barre-choco-caramel, creme-glacee-pot). Script `resync-stocks.js` lancé en `--apply`, 0 erreur.

### 4. Page Revenus carburant (nouveau)
- `public/revenus-carburant.html` + `js/pages/revenus-carburant.js`
- Source : collection `/redistributions` (alimentée par parser `essence` sur `#suivi-achat-essence`)
- 4 KPIs : CA carburant, litres vendus, prix moyen pondéré / L, nombre de stations actives
- Graphique Chart.js : CA par jour (bar chart, thème western)
- Tableau récap par station (avec scroll + tri) : transactions, litres, CA, prix moyen
- Tableau détaillé des transactions (avec scroll + tri)
- Filtres : période (semaine en cours / 7j / 30j) + station
- Export CSV
- Permissions : Patron, Co-Patron, DRH, Responsable Pompiste, Admin Technique
- Entrée nav ajoutée dans le groupe Finance (entre Banque LTD et autres)
- Guide responsable-pompiste mis à jour

---

## ✅ Session 2026-05-10 (partie 2) — Pipeline inventory #logs-ig débogué

### 1. Trois bugs critiques du parser inventory corrigés
Le pipeline `#logs-ig` → bot → Functions → `/stocks` ne fonctionnait PAS depuis l'init du 2026-05-10. Aucun mouvement n'était capté. Trois bugs successifs :

- **Bug A — `owner` vs `source`** (commit `1eb9b2d`) : `parseInventoryEmbed` filtrait `isLtdSource(source)` mais le coffre FiveM est porté par le champ `owner` (ex: `action-27166-0-1`). `source` contient un slot/numéro non significatif (ex: `559`). Fix : tester `owner` OU `source`.
- **Bug B — préfixe `name:` dans la valeur des fields Faab'Hook** (commit `3f07ef6`) : le bot Faab'Hook formate ses embed fields ainsi : `name="owner", value="owner:action-27166-0-1"`. `getField(embed, 'owner')` retournait donc `"owner:action-27166-0-1"`. Conséquence : `isLtdSource()` ne matchait pas (préfixe devenait `"owner:action-27166"`) et `Number(count)` retournait NaN. Fix : nouvelle fonction `stripFieldPrefix()` dans `_helpers.js` qui retire automatiquement le préfixe `{name}:` de la valeur. Corrige tous les parsers consommant des embeds Faab'Hook.
- **Bug C — mapping basé sur display names uniquement** (commit `f1724bd`) : `RAW_MAPPING` contenait les noms commerciaux français ("Bouteille d'Eau", "Spray pour tag") alors que `#logs-ig` envoie les noms internes FiveM (`water`, `spray`). Aucun item ne matchait → tous les `inventory-add/remove` étaient skippés silencieusement. Fix : nouvelle table `INTERNAL_MAPPING` consultée en priorité par `resolveItemId()`.

### 2. Capture exhaustive des noms internes FiveM
La copatronne Luciana Angel Mars a sorti **71 items un par un** des 3 coffres LTD pour générer 1 embed par type d'item. Mapping consolidé dans `INTERNAL_MAPPING` :
- 10 boissons, 14 alimentaire, 9 confiserie, 7 outillage, 3 jardinage, 1 mobilier, 1 électronique, 4 auto, 3 matière première, 2 pêche, 1 emballage, 16 divers.
- Mappings contre-intuitifs documentés : `bigdrill`→`perceuse-manuel` (et `heavy_duty_drill`→`grosse-perceuse-rouge`, l'inverse), `latte`→`koffi-caramel`, `marabou`→`chocolat`, `tronchese`→`outil` générique.

### 3. Split crème glacée en 2 produits
Deux noms internes FiveM observés pour 1 seul item catalogue :
- `sourcream` → "Crème glacée pot" (nouveau ID `creme-glacee-pot`, 2$)
- `icecream` → "Crème glacée cornet" (nouveau ID `creme-glacee-cornet`, 2$)
- ⚠️ Attention `sour_cream` (avec underscore) = "Crème fraîche" (catalogue inchangé).
- Ancien doc `/stocks/creme-glacee` supprimé via `cleanup-creme-glacee.js`.

### 4. 23 items du catalogue restent skippés
Items dont le nom interne FiveM n'a PAS été capturé (la copatronne ne les a pas tous sortis). À rattraper dès qu'un mouvement passe en jeu :
- Alimentaire : baguette, bouteille-eau-purifiee, cola-zero, brique-citron, menus (burger/simple/complet), moutarde, noix-cajou
- Confiserie : bonbon-cola, barre-energetique
- Outillage : foret-perceuse
- Jardinage : tas-terre, fillet, sac-jute
- Électronique : pile
- Auto : huile-shell, bidon-essence
- Matière première : acier
- Divers : ticket-gratter, skate-board, trottinette-electrique, spray-tag (mappé via display "spray", à vérifier)

### 5. Script `resync-stocks.js`
Créé pour forcer la quantité (SET absolu, pas increment) après comptage manuel des coffres IG. Mode dry-run + `--apply`. La copatronne va prendre des screens des 3 coffres (et leurs sous-coffres), l'user remplira la zone STOCKS et lancera le script.

---

## ✅ Session 2026-05-10 (partie 1) — Tout ce qui a été fait

### 1. Refonte catalogue produits + filtrage logs FiveM
- Catalogue `public/js/data/produits.js` réécrit avec **12 catégories** alignées sur l'inventaire réel (boissons, alimentaire, confiserie, outillage, jardinage, mobilier, electronique, auto, matiere_premiere, peche, emballage, divers). 93 items au total (28 nouveaux ajoutés depuis l'export coffre user).
- Nouveau `discord-bot/parsers/items-mapping.js` : table `RAW_MAPPING` nom FiveM display → ID catalogue, `resolveItemId()` insensible casse/accents/suffixe `$`, `isLtdSource()` filtre préfixes `action-27310` (épicerie), `action-27166` (matériel), `action-30439` (entrepôt).
- `inventory.js` : skip silencieux si source non-LTD ou item hors mapping. Émet `item: itemId` canonique + `itemNomBrut` display.
- `onInventory` Functions : utilise itemId résolu, conserve display name pour lisibilité.
- Variantes typos ajoutées (Crème Glaci, Crème Fruiche pour ventes-auto).

### 2. Initialisation stocks (script one-shot)
- `firebase/functions/scripts/init-stocks.js` créé avec snapshot 2026-05-10 des 3 coffres LTD.
- Lancé en `--apply` → **77 docs `stocks/{id}` écrits, 72 059 unités totales**, 0 erreur.
- 3 items sommés (présents dans 2 coffres) : creme-glacee, creme-fraiche, barre-choco-caramel.

### 3. Parser dashboard stations (temps réel)
- Nouveau `discord-bot/parsers/stationsDashboard.js` : lit le message édité en place du canal `#⛽ Station` (8 embeds, 1 par station). Extrait stockActuel, stockMax, niveauPct, prixLitre, derniereRavit, statut (vert/jaune/rouge).
- Bot `index.js` : refactor `MessageCreate` → `handleMessage(msg, source)`, ajout listener `Events.MessageUpdate` (uniquement channels marqués `listenEdits: true`), `fetchOnStartup` au démarrage.
- `onStationsDashboard` Functions : sync `stations/{id}` avec données dashboard.
- 5 doublons stations supprimés (de 13 à 8 docs).

### 4. RH — embauches en attente
- 8 employés actifs détectés dans la catégorie Discord `#══ LIAISONS EMPLOYER ══` :
  - 2 pompistes ⛽ (Charlie WILLIAMS, Liam MARS)
  - 5 épiciers 🛒 (Maverick JACKERTON, Tony TAC, Logan DAVIS, Travis WALLACE, Hailey WILLIAMS)
  - 1 manager 📝 (Nesquik BROAS)
- `firebase/functions/scripts/init-embauches.js` lancé → **8 docs `rhEvenements` (type='embauche', traitee=false)** créés.
- À valider via `/admin` section "Embauches à traiter".

### 5. 3 nouveaux parsers RH structurés (bot Jéssica)
- `discord-bot/parsers/dossierEmploye.js` : forum `#Dossiers-Employers` (threads), parse 6 champs (nom+prénom, téléphone, IBAN, CNI, permis, pôle). Route via `parentId` du thread vers la config CHANNEL_MAP du forum parent.
- `discord-bot/parsers/avertissement.js` : `#logs-avertissement`, parse "Service trop court" (sousType + memberDiscordId + dureeMinutes + début/fin).
- `discord-bot/parsers/licenciement.js` : `#logs-licenciement`, parse 13 champs (idDiscord, idPerso, nom, prenom, IBAN, tel, dateEmbauche, dateFin, type, parQui, raison, casier).
- Functions handlers correspondants :
  - `onDossierEmploye` : stocke `/dossiersEmployes/{threadId}`, enrichit `/users` matchant nom+prénom (skip si ambigu).
  - `onAvertissement` : `/rhEvenements` type='avertissement'.
  - `onLicenciement` : `/rhEvenements` type='licenciement' + bascule `/users` `statut='exclu'` (match par idDiscord puis fallback idPerso).
- `init-dossiers.js` lancé → **9/13 fiches existantes parsées et postées** (3 fiches vides + 1 template skip).

### 6. Cloche d'alertes : marquer comme lu
- `api.js` : `marquerAlerteLue(id)` + `marquerToutesAlertesLues()` (batch).
- `layout.js` : badge ne compte que les **non-lues**, bouton "Tout marquer lu" en haut du dropdown, bouton "✓" individuel sur chaque alerte. Les lues restent visibles grisées.
- `western.css` : styles `.alert-lu`, `.alert-mark-read`, `.btn-mark-all-read`.

### 7. Alertes : seuils manuels uniquement
- **Plus aucune alerte automatique** tant qu'un seuil n'est pas configuré explicitement par le patron (cohérent avec phase de mise en place).
- `alerteStock` : ne crée plus rupture/stock-bas si `seuilAlerte === 0`.
- `alerteStation` : déjà conditionné `seuilL > 0` ou `seuilPct > 0` — retiré l'init `seuilAlertePct=20` par défaut dans `onStationsDashboard`.
- `stocks.js` bouton "Réinitialiser depuis catalogue" : `seuilAlerte` par défaut = 0 (au lieu de 5).
- `creerAlerte` : dédup par entité (`stationId`/`stockId`/`venteId`) au lieu de message — évite spam quand stockActuel fluctue.

### 8. Sécurité Discord token
- Token Discord régénéré (l'ancien traînait en clair dans un fichier .txt sur le bureau).
- Fichier sensible supprimé. `.gitignore` étendu (`*.token`, `*.secret`, `*.credentials.json`, `**/serviceAccountKey*.json`).
- Bot redéployé avec nouveau token côté Railway.

### 9. Scripts utilitaires créés
- `firebase/functions/scripts/init-stocks.js` (77 stocks)
- `firebase/functions/scripts/init-embauches.js` (8 embauches)
- `firebase/functions/scripts/compare-employes.js` (audit users vs Discord)
- `discord-bot/scripts/peek-channel.js` (debug Discord, supporte texte/forum/catégorie)
- `discord-bot/scripts/init-dossiers.js` (rattrapage forum dossiers)
- Tous en mode dry-run par défaut + flag `--apply`.

### 10. Mémoire mise à jour
- `references_canaux_discord_logs.md` : 3 nouveaux canaux RH branchés (Dossiers-Employers, logs-avertissement, logs-licenciement) avec format embeds.
- `references_coffres_ltd.md` : 3 préfixes coffres LTD identifiés.
- `references_roles_employes.md` : convention emoji ⛽/🛒/📝 = pompiste/épicier/manager.
- `projet_inventaire_csv_2026_05_10.md` : gap catalogue documenté.
- `projet_filtrage_logs_fivem.md` : tâches 1-3 marquées implémentées.

---

## 📋 TODO demain (à reprendre dans cet ordre)

1. **Resync complet des stocks LTD** — la copatronne envoie les screens des 3 coffres + sous-coffres, on remplit `firebase/functions/scripts/resync-stocks.js` avec `{id, qty}` puis on lance `--apply`. Force la quantité absolue (écrase l'init du matin + tous les mouvements précédents).
2. **Capturer les 23 items manquants** — quand un de ces items passe en jeu (#logs-ig), récupérer son embed et l'ajouter à `INTERNAL_MAPPING`. Liste : baguette, bonbon-cola, bouteille-eau-purifiee, cola-zero, brique-citron, menus, moutarde, noix-cajou, foret-perceuse, tas-terre, fillet, sac-jute, pile, huile-shell, bidon-essence, acier, ticket-gratter, skate-board, trottinette-electrique, barre-energetique, spray-tag (à vérifier).
3. **Valider les 8 embauches via `/admin`** — attendre confirmation de Blake sur qui est encore actif. Pour chacun : saisir email + idPerso FiveM + générer mot de passe provisoire.
4. **Relancer `init-dossiers.js --apply`** après création des comptes — l'enrichissement `/users` (téléphone, IBAN, pôle) se déclenchera cette fois (matching nom+prenom).
5. **Tournée 8 stations essence** → relevé manuel des vrais niveaux → je crée `init-stations.js` (script + dry-run + `--apply`).
6. **Compléter les prix** des ~16 nouveaux produits via `/admin` (whey, plats cuisinés, perceuses, matières premières, etc.) — actuellement à 0 avec note "à confirmer".
7. **IDs des coffres station-essence** à demander à Blake (FiveM `action-XXXXX-X`) pour étendre `SOURCES_LTD_PREFIXES` dans `discord-bot/parsers/items-mapping.js`.

## 🔔 Rappels datés à ne pas manquer

- **2026-09-01 → 2026-09-30** : upgrade Cloud Functions vers **Node 22** +
  `firebase-functions@latest`. Node 20 sera décommissionné le **2026-10-30**
  par Google Cloud (plus de redéploiement possible après). Procédure :
  1. `cd firebase/functions && npm install --save firebase-functions@latest`
  2. Dans `package.json` : `"engines": { "node": "22" }`
  3. Tester localement avec l'emulator
  4. Re-déployer toutes les Functions et vérifier les logs
  5. Risques : breaking changes possibles sur la syntaxe v2 (`onSchedule`,
     `onRequest`, `onDocumentCreated`). Voir
     https://firebase.google.com/docs/functions/beta/release-notes

## 🔧 Audit/optimisations à faire (non bloquant, mais à planifier)

- **Cloche alertes — règles Firestore restrictives** : `update` sur `/alertes` n'est autorisé que pour `canAdmin || isDRH || isResponsable`. Le bouton "marquer lu" sera bloqué silencieusement pour les autres rôles. Soit étendre les rules pour `lu: true` à tout user actif, soit masquer la cloche/le bouton pour les rôles sans permission.
- **Migration anciennes catégories produits** : tant que tu n'as pas cliqué "Réinitialiser depuis catalogue" sur `/stocks`, les anciens docs `produits/{id}` ont les anciennes catégories (`agriculture`, `mecanique`, `nourriture`, `document`) — invisibles dans le filtre dropdown qui utilise les 12 nouvelles.
- **Nettoyage 30+ alertes existantes** générées avant le passage en seuils-manuels. Soit tu cliques "Tout marquer lu", soit on script une suppression définitive.
- **Doublon Blake Mars** dans le forum dossiers (2 threads) : à nettoyer manuellement côté Discord.
- **3 fiches RH non parseables** (Aaron knox, Kaï Saint, Karl Williams) : à inspecter manuellement (probablement vides ou format custom).
- **Compatibilité tablette FiveM** : tests manuels nécessaires (pas de popup, pas de nouvel onglet) — pas vérifié ce soir.
- **Audit perf Functions/Firestore** : usage actuel reste faible (~30 alertes, 172 mouvementsStock, 102 logsBruts), pas urgent. À profiler quand trafic monte.
- **MAJ guides 01-05 et 07** : reflètent encore l'état initial pré-2026-05-10. À relire/MAJ quand temps disponible.

---

## 🎯 Vue d'ensemble

Plateforme web de gestion pour le LTD Sandy Shores (épicerie multisites + 8 stations-essence sur serveur FiveM RP). Conforme TTE Chap. IV — Secteur 2.

| Composant | URL / Référence |
|-----------|-----------------|
| 🌐 **Application live** | https://lahagragaming93-debug.github.io/ltd-sandy-shores/ |
| 📦 **Code source** | https://github.com/lahagragaming93-debug/ltd-sandy-shores |
| 🔥 **Console Firebase** | https://console.firebase.google.com/project/ltd-sandy-shores-f3919 |
| 🚂 **Bot Railway** | https://railway.com (compte `lahagragaming93-debug`) |
| 🤖 **Bot Discord** | LTD Sandy Shores Bot#0243 (serveur LTD SandyShores) |

---

## ✅ Ce qui a été fait (session 2026-05-08 → 2026-05-09)

### 1. Création de la plateforme (de zéro)
- Architecture : Vanilla JS + Firebase + Cloud Functions + bot Discord
- 4800 lignes de code, 53 fichiers
- Thème western (rouge sang / beige sable / noir / blanc cassé)
- 8 modules métier : Dashboard, Stocks épicerie, Stations essence, Ventes, Comptabilité, RH, Admin, Mon espace, Mes paies

### 2. Setup Firebase complet
- Projet `ltd-sandy-shores-f3919` créé
- Authentication Email/Password activée
- Firestore Database (région eur3) avec règles strictes par rôle
- 5 indexes composites déployés
- Plan Blaze (pay-as-you-go, 0 € attendu)
- Budget alerte recommandé (5 €/mois)

### 3. Cloud Functions déployées (5)
- `botIngest` (HTTP) — endpoint webhook pour le bot Discord
- `clotureHebdo` — cron lundi 00h00 Europe/Paris
- `alerteStock`, `alerteStation`, `alerteVenteSansStock` — triggers Firestore
- Secret `LTD_BOT_INGEST_TOKEN` configuré (v3, propre, sans newline parasite)

### 4. Bot Discord
- Application Discord créée (`LTD Sandy Shores Bot`)
- Invité sur le serveur avec permissions `View Channels` + `Read Message History`
- 7 parsers structurés : `inventory`, `service`, `facture`, `essence`, `depense`, `paie`, `coffre`
- 8 canaux logs bruts (pour archives)
- Hébergement **Railway 24/7** (gratuit, ~$5/mois de crédits inclus)
- Diagnostic permissions intégré (au démarrage, vérifie chaque canal)

### 5. Frontend
- Déployé sur GitHub Pages avec workflow auto sur push
- Domaine `lahagragaming93-debug.github.io` autorisé dans Firebase Auth
- Repo public (nécessaire pour GitHub Pages gratuit)
- Chart.js intégré pour graphiques dashboard

### 6. Données initialisées
- **8 stations essence** créées avec capacités + prix + seuils 20% :
  - Senora Way - Rex's Diner (10 000 L, 5 $)
  - Route 68 LTD (7 500 L, 5 $)
  - Route 68 (10 000 L, 5 $)
  - Panorama Drive - Aérodrome Sandy Shores (5 000 L, 5 $)
  - Palomino Freeway - Favélas (15 000 L, 6 $)
  - Clinton Avenue - Vinewood (15 000 L, 5,50 $)
  - Cholla Springs Avenue (5 000 L, 4,50 $)
  - Algonquin Boulevard (5 000 L, 4,50 $)
- **Catalogue 53 produits** initialisé avec prix achat + vente (basés sur tarifs ancien patron, règle 2,5× coût de revient)
- 4 produits **sans prix d'achat** à compléter : Menu Burger ice tea, Canne à pêche, Croquette, Sac en Jute

### 7. Audit + corrections (8 fixes)
- 🔴 Rules Firestore `/users` restreintes (lecture sensible)
- 🔴 Race condition `quotaPompiste` corrigée (`FieldValue.increment()` atomique)
- 🔴 Logique date `clotureHebdo` corrigée (cron lundi 00h, semaine lun→dim complète)
- 🔴 Limites sur queries (`listUsers` 200, `listProduits` 500)
- 🟠 Audit trail des prix (collection `historiquePrix` append-only)
- 🟠 Validation inputs config admin (refuse quotas ≤ 0)
- 🟠 Toasts d'erreur explicites (9 endroits, plus de « Erreur. » générique)
- 🟢 Cleanup policy Artifact Registry

### 8. 4 features bonus
- ✨ **Notifications Discord** : alertes postées sur webhook configuré (rupture, masse > 90%, etc.)
- ✨ **Conservation 100% historique** : suppression de la purge agressive (TTE = MIN 6 sem, on garde tout)
- ✨ **Dashboard Chart.js** : 2 graphiques (ventes par jour, top 5 produits)
- ✨ **Page Mes paies** : historique paies reçues + KPIs perso pour chaque employé
- 🔧 Résolution auto des IDs Firebase (vendeurId via idDiscord, beneficiaireId via idPerso)

### 9. Comptes créés
| Email | Rôle | Personne |
|-------|------|----------|
| `lahagragaming93@gmail.com` | Patron | toi (boulalahagra, intendant temporaire) |
| `maximegreaume@gmail.com` | Patron | Maxime BLAKE (vrai patron RP) |

### 10. Sécurité — verrouillage final
- Inscription publique **fermée** à 3 niveaux : UI (onglet retiré), JS (throw immédiat), rules Firestore (`allow create: isDirection()` uniquement)
- Tous les futurs comptes seront créés via **Administration** par un Patron

### 11. Documentation incluse (`docs/`)
- `01-setup-firebase.md` — création projet + déploiement règles + Functions
- `02-setup-discord-bot.md` — config bot + hébergement
- `03-setup-github-pages.md` — déploiement frontend
- `04-premier-compte.md` — init données + premier patron
- `05-guide-utilisation.md` — guide quotidien direction + employés
- `06-architecture.md` — schéma flux + collections Firestore
- `07-transmission.md` — passation au vrai patron (Firebase, GitHub, Railway, Discord)
- **`JOURNAL.md`** — ce document

---

## ✅ Session de reprise — 2026-05-09 (suite)

> **14 commits supplémentaires + 4 déploiements rules + 2 déploiements Cloud Functions.**

### 12. Données catalogue
- **53 prix** poussés via page d'init temporaire éditable (puis page supprimée)
- **8 nouveaux produits** ajoutés : Menu simple/complet, Baguette, Barre choco caramel, Bac jardinage, Trottinette électrique, Pile, Éponge pour voiture
- Catalogue final : 61 produits dans `public/js/data/produits.js`

### 13. Compatibilité tablette FiveM CEF in-game
- Tous les `confirm()` / `alert()` / `prompt()` natifs **remplacés** par modaux dans le site (`utils/confirmation.js`)
- Modal **CRITIQUE 3 secondes** pour les actions destructives + champ `requireType: SUPPRIMER` à taper
- **Bouton retour ←** + **menu hamburger ☰** dans la topbar
- Sidebar drawer + overlay sur petit écran
- Aucun `target="_blank"` (la nav reste dans la même fenêtre)
- 4 breakpoints responsive : 1280 (FiveM CEF) / 1024 / 600 / 380 px
- Boutons tactiles 44 px min sur mobile

### 14. Guide complet par rôle (~1 815 lignes)
- 9 fichiers MD dans **`public/guide/`** (était `docs/guide/`, déplacé pour être servi par GitHub Pages)
- Index + 1 par rôle (direction / DRH / resp vente / resp pompiste / vendeur / pompiste) + automatismes + FAQ
- **Onglet « 📖 Guide » dans la sidebar** : page `guide.html` qui charge marked.js et rend les .md en HTML formaté, auto-sélection du chapitre selon rôle, deep-link `?guide=01-direction`, boutons Imprimer/PDF + GitHub

### 15. Visuel
- **Logo + favicon** intégrés (sidebar, page login, onglet navigateur) — assets dans `public/img/`
- **Topbar refondue** :
  - Avatar circulaire avec initiales, couleur selon famille de rôle
  - Nom en font-heading + **11 badges de rôle distincts** colorés
  - Bouton déconnexion en pastille ronde avec rotation au hover
- **Cloche d'alertes Facebook-style** (🔔 + badge) :
  - Dropdown 360 px avec animation `bellRing` au montage
  - Liste des 30 dernières alertes (icône type + message + heure relative + flèche)
  - Bordure gauche colorée selon gravité
  - Click sur alerte → redirige vers la page concernée (stocks/stations/ventes)
  - Fermeture click outside + Escape

### 16. Hiérarchie Admin (DRH + Responsables gèrent leur équipe)
- **DRH** : tous comptes sauf Patron / Co-Patron (peut gérer un autre DRH, mais PAS Admin Technique)
- **Resp Vente** : uniquement vendeurs Novice/Inter/Exp (création + promotion entre grades + suspension + suppression)
- **Resp Pompiste** : idem pour pompistes
- Lignes hors périmètre **visibles mais grisées** (transparence)
- Sécurité **côté serveur** (rules Firestore : helper `canManage(currentRole, targetRole)`)
- Patron / Admin Tech peuvent **modifier leur propre rôle** (mais pas se suspendre / supprimer)

### 17. Export Comptabilité Google Sheets temps réel
- Cloud Function `comptaExport` (HTTP, region europe-west1) avec token sécurisé
- 4 types : `?type=resume | depenses | ventes | paies`
- Format CSV UTF-8 (BOM) avec dates `dd/MM/yyyy HHhmm:ss` (timezone Europe/Paris, non auto-converti par Sheets)
- Résolution `<@discordId>` → nom réel via map précalculé
- Token stocké dans `/config/secrets.comptaExportToken` (rule serveur : direction + super-admin uniquement)
- UI dans Admin → bouton 📊 Export Google Sheets : modale qui affiche les 4 formules `=IMPORTDATA(...)` à coller dans le Sheet, boutons Copier
- Secret Firebase `LTD_COMPTA_EXPORT_TOKEN` (32 bytes hex)

### 18. Création produits depuis le site
- Bouton **« + Ajouter un produit »** dans Stocks (visible Direction + DRH + Super-admin)
- Modale : nom, ID auto-slug, catégorie, prix achat/vente, seuil, stock initial optionnel
- Modal critique 3 sec si prix achat > prix vente (vente à perte)
- Stock initial > 0 → mouvement « Création produit » tracé dans l'audit
- Rules Firestore split create/update/delete sur /produits

### 19. Refonte page Comptabilité
- 4 KPIs colorés : CA (vert), Charges (rouge), Masse salariale (orange), Bénéfice (bleu / rouge si perte)
- **Templates dépenses rapides** : 5 boutons (Matières premières / Avocat / Entretien véhicule / Loyer / Autre) qui pré-remplissent le formulaire
- **Gauge masse salariale visuelle** avec marqueur 90 %, animation pulse rouge si HORS TTE
- **Section "💰 Salaires & paies"** : tableau par groupe (Direction / Resp / Vendeurs / Pompistes) avec salaire estimé + versé + reste à verser par employé
- **Bouton « 📋 Copier récap Discord »** : prépare un message formaté avec les montants à verser, à coller dans `#paie`

### 20. Rôle « 🛠 Admin Technique » (super-admin invisible)
- Tous les droits du Patron côté UI/Admin
- **EXCLU** des calculs financiers : compta, masse salariale, salaires affichés, effectif RH (mention discrète "+N tech" dans le KPI Effectif)
- Plafond salaire = 0 (rôle non rémunéré)
- Badge violet `#6a3a8a` avec animation `techGlow` pulsante
- Avatar violet aussi
- **Hiérarchie** : Patron peut le créer/supprimer (sécurité). DRH et Co-Patron NE PEUVENT PAS le voir/gérer.
- Helper `canAdmin()` = `isDirection() || isSuperAdmin()` utilisé partout dans rules + UI
- Helper `compteEnFinance(role)` = `!isSuperAdmin(role)` utilisé pour filtrer compta/RH

### 21. Bugfixes session
- Stations : refresh visuel immédiat après save (mise à jour optimiste — listener Firestore peut avoir 1-2 s de latence)
- Sheets dates : format `09/05/2026 14h30:25` non interprété comme date série numérique
- Sheets utilisateurs : `<@undefined>` → `— (non résolu)`, ID Discord brut → nom réel
- Doc vendeur : « le bot ne te paiera pas » → « la direction ne te paiera pas »
- Patron + Admin Tech peuvent modifier leur propre rôle (avant : sélecteur grisé sur sa propre ligne)

### 22. Documentation
- `LIENS.md` à la racine : tous les liens utiles (site, guides, Firebase, Cloud Functions, comptes, etc.)
- README mis à jour avec plan de docs (setup + utilisation par rôle)
- Guides 01/02/03/04/07/08 mis à jour pour refléter hiérarchie + ajout produit + compta refonte

---

## ✅ Session de reprise — partie 2 (parsers Discord avancés)

> **5 commits supplémentaires + 2 déploiements rules + 2 déploiements Cloud Functions + 1 release Apps Script (5e onglet).**
>
> Cette partie 2 finalise l'**ingestion Discord avancée** : on ne se contente plus des 7 parsers initiaux, on capte aussi les flux automatiques RP (banque officielle, RH auto, promotions auto, stats hebdo officielles FiveM, rapports pompiste quotidiens, ventes auto). Objectif : **rapprochement comptable IRS RP** entre nos calculs internes et les chiffres officiels FiveM, audit financier complet sur la banque LTD.

### 23. Parsers Discord avancés (5 nouveaux + 1)

#### Commits couverts
| SHA | Sujet |
|-----|-------|
| `b158a52` | Banque LTD : parser **xbankaccount** + collection `/banqueLtd` + solde temps réel |
| `60a7987` | **5 nouveaux parsers Discord** + outil **découverte items FiveM** |
| `6dcbbdc` | Bouton **supprimer produit** dans Stocks (Direction + DRH) |
| `d43a4a0` | **Cloud Function `?type=banque`** + Apps Script **5e onglet Banque LTD** |
| `affc847` | **Page Banque LTD** (mouvements bancaires temps réel) |

#### 23.1 Parser `xbankaccount` (banque officielle LTD)
- Discord bot écoute le canal banque + filtre les transactions sur l'**iban LTDSANDY** (tout autre iban est ignoré)
- Cloud Function handler `onBankAccount` → écrit dans `/banqueLtd` (champs : `type` add/remove, `montant`, `soldeAvant`, `soldeApres`, `raison`, `iban`, `accountId`, `source: 'discord-xbankaccount'`)
- **Solde temps réel** = dernier `soldeApres` de la collection (ordré par timestamp desc, limit 1)
- Rules : lecture `canAdmin() || isDRH()`, écriture interdite côté client (le bot écrit via Admin SDK)

#### 23.2 KPI « Solde banque LTD » sur Dashboard
- Tuile dédiée en haut du dashboard (v1 = source `depenses` puis migration vers `banqueLtd` quand le parser xbankaccount tourne)
- Couleur dynamique : vert si > 100k $, jaune si > 0, rouge sinon
- Mise à jour live (listener Firestore)

#### 23.3 Page **Banque LTD** (`banque.html`)
- Affiche le solde courant en gros + tableau chronologique de tous les mouvements
- Filtre par type (entrée / sortie) + recherche texte sur la raison
- Code couleur entrées/sorties (vert/rouge) + colonne « variation » avec ▲▼
- Accès : `ACCESS.banque = direction + DRH + super-admin`
- Entrée NAV groupe « Finance », icône 🏦

#### 23.4 5 nouveaux parsers Discord (#commit `60a7987`)
| Parser | Type ingest | Collection cible | Effet de bord |
|--------|-------------|------------------|----------------|
| `autoRh` | `auto-rh` (embauches/exclusions) | `/rhEvenements` | **Exclusion** : suspend auto le compte (statut → `suspendu`). **Embauche** : crée alerte info pour rappel admin |
| `autorankup` | `autorankup` (promo auto) | met à jour `/users/{uid}.role` | Cherche par `idDiscord` → fallback nom complet, conserve `ancienRole` |
| `statsbank` | `statsbank` (récap hebdo officiel FiveM) | `/statsHebdoOfficiels/{S{NN}-{annee}}` | Idempotent (1 doc/semaine). Champs : CA, sorties, bénéfice brut, solde actuel, loyers, **impôt estimé**, tranche, taux, nb factures/payés |
| `rapportPompiste` | `rapport-pompiste` (#pompiste) | `/rapportsPompisteQuotidien` | **Met à jour `stockActuel` de chaque station** depuis le % de remplissage du rapport (mapping FiveM → stationId requis) |
| `venteAuto` | `vente-auto` (distributeur auto) | `/ventes` (avec `source: 'ventes-auto'`) | Bénéfice = 0 (pas calculable sans mapping noms FiveM ↔ catalogue) |

#### 23.5 Outil **Découverte items FiveM** (`decouverte-items.html`)
- Page utilitaire (admin tech / dev) qui scanne `/mouvementsStock` et `/stocks` pour lister tous les `item` distincts captés par le bot
- Aide à constituer la **whitelist/blacklist** items (futur filtre parser inventory) + le mapping FiveM ↔ catalogue produits
- Affiche aussi les noms de stations FiveM bruts vus dans `/rapportsPompisteQuotidien` pour aider à construire le mapping `stationId`

#### 23.6 Bouton supprimer produit (Stocks)
- Sur chaque ligne du tableau Stocks : nouveau bouton 🗑 visible **Direction + DRH**
- Modal critique 3 sec + champ `requireType: SUPPRIMER` (pattern destructif standard)
- Suppression du doc `/produits/{id}` ET du doc `/stocks/{id}` associé + écriture d'un mouvement « Suppression produit » pour audit

#### 23.7 Cloud Function `?type=banque` + Apps Script 5e onglet
- Nouveau type d'export CSV : `?type=banque` qui combine `/banqueLtd` (entrées) + `/depenses` (sorties) en un seul tableau chronologique avec solde après chaque opération (limit 2000 lignes)
- Apps Script Google Sheets : 5e onglet auto **« Banque LTD »** créé/migré, formules `IMPORTDATA(...?type=banque&token=...)` injectées, mise en forme (couleurs entrées/sorties)
- Permet à l'auditeur IRS RP de voir TOUS les mouvements du compte LTD chronologiquement

### Collections Firestore introduites
- `/banqueLtd` — mouvements xbankaccount (audit + solde live)
- `/rhEvenements` — embauches/exclusions auto (audit append-only)
- `/statsHebdoOfficiels/{S{NN}-{annee}}` — stats officielles FiveM hebdomadaires (idempotent, 1 doc/semaine)
- `/rapportsPompisteQuotidien` — rapports quotidiens du canal #pompiste (avec niveaux par station)

---

## 📋 Ce qui reste à faire (TODO mis à jour 2026-05-09 partie 2)

### ✅ Fait dans la session de reprise (parties 1 + 2)
- ✅ ~~Compléter 4 prix d'achat~~ — intégrés dans la liste 53 finale
- ✅ ~~Liste produits complète à intégrer~~ — fait via init-prix-v2.html
- ✅ ~~Bouton « Supprimer un produit » dans Stocks~~ — fait (commit `6dcbbdc`)
- ✅ ~~Conciliation bancaire (rapprochement paie Discord et salaireDecide)~~ — préparé via `/banqueLtd` + page Banque LTD + export Sheets `?type=banque` (rapprochement manuel possible dans le 5e onglet Apps Script)
- ✅ ~~Stats avancées : comparaison N vs N-1~~ — bases posées via `/statsHebdoOfficiels` (parser statsbank), reste à câbler la page comparative E (en cours)

### Priorité haute (à faire de ton côté en 5 min)
- [ ] **Te basculer en Admin Technique** : Admin → ta ligne → sélecteur Rôle → 🛠 Admin Technique
- [ ] **Configurer le Sheet Compta** : Admin → 📊 Export Google Sheets → coller token → créer Sheet sur sheets.new → coller les 5 formules (résumé / dépenses / ventes / paies / banque)
- [ ] **Configurer le webhook Discord pour alertes** (Admin → ⚙ Configuration globale → URL Webhook)
- [ ] **Budget alerte Firebase** (5 €/mois) → console GCP → Billing

### Priorité moyenne (Maxime BLAKE quand il prendra la main)
- [ ] **Créer les comptes employés** (DRH, responsables, vendeurs, pompistes) avec ID Discord + ID Perso obligatoires
- [ ] Décider les salaires des direction/responsables dans RH
- [ ] **Mapping FiveM → catalogue interne** (toujours en attente — bloquant pour `venteAuto` et `rapportPompiste`)
  - **Items FiveM ↔ produits LTD** : utiliser l'outil `decouverte-items.html` pour lister les items distincts captés, puis ajouter une table de correspondance dans `discord-bot/parsers/inventory.js` (et `venteAuto`)
  - **Noms stations FiveM ↔ stationId** : idem pour les rapports pompistes (lever le `[pompiste] Station inconnue` dans les logs Cloud Functions)

### Priorité basse (nice to have, optionnel)
- [ ] Page « Mon profil » pour que chaque utilisateur édite ses propres ID Discord/Perso
- [ ] Filtrage des items parasites Discord (ex. `item:contrat`) — liste blanche/noire dans le parser (s'appuyer sur la sortie de `decouverte-items.html`)
- [ ] Rapport PDF mensuel automatique (l'export Sheets fait déjà le job)
- [ ] Mode hors ligne renforcé (Service Worker)

### À l'arrivée du moment
- [ ] **Transmission technique au vrai patron** → suivre `docs/07-transmission.md`
  - Firebase, GitHub, Railway, Discord Bot dans cet ordre
  - Suppression du compte intendant en dernier (le rôle Admin Technique disparaîtra avec)

---

## 🐛 Comportements connus (pas des bugs)

### Alertes pour items hors catalogue (ex. `item:contrat`)
Le bot Discord crée automatiquement un stock pour TOUT item qui passe dans `#logs-ig`, même hors catalogue LTD. Conséquence : tu peux voir des alertes type `Rupture : item:contrat` pour des objets RP non commerciaux (uniformes, papiers, contrats).

**3 options** :
- Ignorer l'alerte
- Supprimer le doc `/stocks/{id}` via console Firebase
- Marquer l'alerte résolue dans `/alertes/{id}`

Pour les éliminer définitivement, il faudrait ajouter une **liste blanche/noire** dans `discord-bot/parsers/inventory.js` (TODO priorité basse).

### Sheets refresh ~1 h
Google force `IMPORTDATA` à refresh ~1 fois par heure max. Pour un refresh immédiat, modifie temporairement la formule (espace + valider + retirer espace).

---

## 🔄 Comment reprendre le travail

### Pour reprendre avec Claude Code (recommandé)

1. **Ouvrir un terminal** (PowerShell ou Bash)
2. Aller dans le dossier du projet :
   ```
   cd "C:\Users\antho\Desktop\LTD Sandy Shores"
   ```
3. Lancer Claude Code :
   ```
   claude
   ```
4. La **mémoire est automatiquement chargée** — je sais qui tu es, ce qu'on a fait, où on en est. Tu peux me dire simplement « on reprend » ou « voici la liste de produits qu'on attendait ».

### Pour vérifier l'état du système

| Quoi | Où |
|------|-----|
| L'app fonctionne ? | https://lahagragaming93-debug.github.io/ltd-sandy-shores/ |
| Le bot tourne sur Railway ? | https://railway.com → Deployments → Logs |
| Les Functions tournent ? | https://console.firebase.google.com/project/ltd-sandy-shores-f3919/functions |
| Des données arrivent dans Firestore ? | https://console.firebase.google.com/project/ltd-sandy-shores-f3919/firestore |
| Des erreurs récentes ? | `firebase functions:log` (depuis le dossier `firebase/`) |

### Pour reprendre sans Claude (à la main)

Tous les fichiers importants sont commentés et organisés. Voici les points d'entrée :

| Tu veux modifier… | Va voir… |
|-------------------|----------|
| L'apparence (thème, couleurs, mise en page) | `public/css/western.css` |
| Une page (logique métier) | `public/js/pages/<nom>.js` (ex: `dashboard.js`, `stocks.js`) |
| Le calcul de paie | `public/js/utils/paie.js` |
| Les permissions par rôle | `public/js/utils/permissions.js` |
| Le catalogue produits par défaut | `public/js/data/produits.js` |
| Le bot Discord (parsers, dispatch) | `discord-bot/index.js` + `discord-bot/parsers/` |
| Les Cloud Functions (clôture, alertes, ingest) | `firebase/functions/index.js` |
| Les règles de sécurité Firestore | `firebase/firestore.rules` |

### Pour déployer une modif

```bash
# Frontend (auto-déploiement sur push)
git add public/...
git commit -m "MAJ frontend"
git push

# Cloud Functions (manuel)
cd firebase
firebase deploy --only functions

# Règles Firestore (manuel)
firebase deploy --only firestore:rules

# Bot Discord (auto-redéploiement Railway sur push de discord-bot/)
git add discord-bot/...
git commit -m "MAJ bot"
git push
```

---

## 🚨 Points d'attention

- **Token Discord** stocké dans `.env` du bot (Railway variables d'env, pas commit sur GitHub)
- **Secret Firebase** `LTD_BOT_INGEST_TOKEN` (v3, configuré via Firebase Secrets Manager — JAMAIS le mettre en clair)
- **Le repo est public** — ne jamais commit de credentials (le `.gitignore` les exclut déjà)
- **Plan Blaze** activé sur Firebase — coût attendu 0 €, mais surveiller la conso si volume explose
- **Maxime BLAKE** est le vrai patron — toi tu te retireras quand tout sera stable (suivre `docs/07-transmission.md`)

---

## 📞 En cas de souci au redémarrage

- **Site ne charge pas** → vérifier https://www.githubstatus.com/ (incident GitHub Pages)
- **Login refusé** → vérifier que `lahagragaming93-debug.github.io` est bien dans Firebase Auth → Authorized domains
- **Bot ne remonte plus rien** → Railway logs → vérifier que le bot s'est connecté + permissions canaux Discord
- **Erreur 401 sur botIngest** → token Firebase obsolète, régénérer (cf. `feedback_firebase_secrets.md` en mémoire)
- **Quelque chose est cassé après une modif** → `git log --oneline | head -5` pour voir les derniers commits, `git revert <sha>` pour annuler

---

## 🤠 Mot de la fin

Tout tourne, tout est sécurisé, tout est documenté. Le système peut fonctionner sans intervention pendant des semaines.

Demain, tu reprends d'où tu veux : intégrer les nouveaux produits quand tu auras la liste, créer des comptes employés, peaufiner le visuel, ou ajouter des features. La plateforme est prête pour la production. 🌵

---

> **Pour Claude (futur moi) qui lira ce document** : la mémoire dans `C:\Users\antho\.claude\projects\C--Users-antho-Desktop-LTD-Sandy-Shores\memory\` contient les détails techniques (URLs Firebase, identité du vrai patron, traps Windows pour les secrets, contexte de transmission). Lire le fichier `MEMORY.md` à l'arrivée pour reprendre dans le bon contexte.
