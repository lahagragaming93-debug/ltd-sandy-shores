# 📖 Journal de bord — LTD Sandy Shores

> Document de reprise pour les prochaines sessions de travail.
> Dernière mise à jour : **2026-05-15 (refresh complet doc compta + habillage 4 feuilles + badge fournisseur côté UI)**

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
