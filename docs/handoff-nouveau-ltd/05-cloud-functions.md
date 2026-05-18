# 05 — Cloud Functions — détail endpoint par endpoint

> Toutes les functions dans `firebase/functions/index.js` (4172 lignes). Région : `europe-west1`. Runtime : Node 20.

---

## ⏰ Crons (onSchedule)

### `clotureHebdo` — Clôture étape 1 (lundi 00h00 Paris)

**Schedule** : `'0 0 * * 1'` TZ `Europe/Paris`
**Secrets** : `[DASHBOARD_SA_KEY]`

**Actions** :
1. Calcule bornes semaine S-1 (lun 00h précédent → dim 23h59.999 Paris)
2. Lit `/ventes`, `/depenses`, `/redistributions`, `/banqueLtd` sur la fenêtre
3. Calcule : CA produits, CA carburant, dépenses totales, charges déductibles, bénéfice brut
4. Écrit/met à jour `/semaines/{weekKey}` avec statut `cloturee-partielle`
5. Pose `weekKeyAttribuee=weekKey` sur les paies versées dans la fenêtre paie (lun N+1 00h → mar N+1 21h)
6. **Snapshot estimations paies** : `snapshotPaiesEstimees()` crée `/paiesEstimees/{weekKey}_{userId}` pour chaque user actif `compteEnFinance`
7. **Snapshot onglet Sheet** : `snapshotSheetSemaine()` crée l'onglet `Semaine N (jj-jj mois aaaa)` avec KPI + tables (figé)
8. **Renomme onglets live** : `renameLiveOnglets()` met les titres `Ventes Semaine N+1 (...)` / `Dépenses Semaine N+1 (...)`

**Try/catch englobant** : la clôture ne doit JAMAIS échouer même si Sheets KO. Chaque étape isolée.

---

### `clotureHebdoPaies` — Clôture étape 2 — filet de sécurité (mardi 21h05 Paris)

**Schedule** : `'5 21 * * 2'` TZ `Europe/Paris`

**Actions** :
1. **Skip si statut `cloturee-manuelle`** (le patron a déjà cliqué 🔒)
2. Sinon, lit toutes les paies versées dans la fenêtre `[lun 00h, mar 21h]`
3. Calcule masse salariale, bénéfice net = CA - dépenses - masse salariale
4. Met à jour `/semaines/{weekKey}` avec statut `cloturee`

---

### `verifierSortiesExpirees` — Cron anti-vol stock

**Schedule** : every 30 min (vérifier)

**Actions** :
- Détecte les sorties de bidons sans ravitaillement correspondant dans le délai imparti
- Crée alertes dans `/alertes`

---

### `dashboardKeepAlive` — Cron every-minute

**Schedule** : `'* * * * *'`

**Actions** :
- Lit la cellule A1 de l'onglet `📊 Dashboard` du Sheet
- Si vide ou pas le bon titre, appelle `regenererDashboard` pour recréer
- Empêche le Dashboard de "disparaitre" si quelqu'un l'écrase accidentellement

---

### `cronAlertesEngagements` — Alertes dettes proches échéance

**Schedule** : quotidien (matin)

**Actions** :
- Liste `/engagements` avec `statut: 'actif'`
- Si échéance ≤ 7 jours → crée alerte `/alertes`
- Si échéance dépassée → alerte critique

---

## 🌐 Endpoints HTTP (onRequest)

> Tous en région `europe-west1`. CORS activé. Auth via Bearer token Firebase Auth ID token (sauf `botIngest` et `comptaExport` qui ont leur propre auth).

### `botIngest` — Endpoint d'écriture du bot Discord

**Méthode** : POST
**Auth** : Header `X-Bot-Secret` avec valeur env `BOT_INGEST_SECRET` (ou similaire)

**Body** :
```json
{
  "type": "vente" | "depense" | "paie" | "ravitaillement" | ...,
  "data": { ... payload type-specific }
}
```

**Actions** :
- Selon `type`, route vers le handler approprié
- Valide les champs, déduplique si pertinent (factureId)
- Écrit en Firestore via Admin SDK
- Auto-classification dépenses via mapping fournisseurs

---

### `declarerVente` — Déclaration manuelle vente par un vendeur

**Méthode** : POST
**Auth** : Bearer (Firebase ID token) — tout user authentifié, vérifié `isVendeur` ou direction

**Body** : `{ factureId, clientNom, produits: [{produitId, quantite}], paiement }`

**Actions** :
- Calcule montant total + bénéfice via catalogue stocks
- Crée doc `/ventes` avec `source: 'manuelle'`, `factureId: 'M20260518-XXXX'`
- Si bot Discord avait déjà ramassé une vente avec même factureId → match + `cachee: true` sur la bot
- Déduit le stock des produits

---

### `modifierVente` — Modification d'une vente

**Méthode** : POST
**Auth** : Bearer + direction OU responsable-vente OU DRH

**Body** : `{ venteId, raison?, clientNom?, montant?, produits? }`

**Actions** :
- Vérifie permissions
- Trace la modif dans `/ventes/{id}/historique`
- Recalcule bénéfice, stock si produits modifiés

---

### `pompisteRavitaillerManuel` — Pompiste ravitaille une station

**Méthode** : POST
**Auth** : Bearer + isPompiste OU responsable-pompiste OU direction

**Body** : `{ stationId, bidons, prixCarburant? }`

**Actions** :
- Déduit `stocksBidons` du compte pompiste
- Ajoute au stock pompe de la station
- Crée doc `/stations/{id}/ravitaillements`
- Met à jour quota hebdo du pompiste

---

### `pompisteCorrigerStock` — Correction stock station

**Méthode** : POST
**Auth** : Bearer + responsable-pompiste OU direction

**Body** : `{ stationId, pompeIdx, nouveauStock, raison }`

**Actions** :
- Trace la correction dans `/stations/{id}/corrections`
- Met à jour le stock pompe

---

### `pompisteDeclarerCaoutchoucs` — Pompiste déclare des caoutchoucs

**Méthode** : POST
**Auth** : Bearer + isPompiste

**Body** : `{ quantite, station? }`

**Actions** :
- Ajoute aux stats caoutchoucs du pompiste pour la semaine en cours
- Compte dans le quota hebdo

---

### `cloturerSemaine` — Bouton 🔒 patron sur `/comptabilite`

**Méthode** : POST
**Auth** : Bearer + `requireDirection` (patron / co-patron / admin-technique)
**Secrets** : `[DASHBOARD_SA_KEY]`

**Body** :
```json
{
  "weekKey": "2026-05-11",
  "confirmationIRS": true,        // OBLIGATOIRE
  "note": "Semaine standard, RAS"
}
```

**Actions** :
1. Vérifie `confirmationIRS === true` (sinon 400)
2. Vérifie qu'on est bien après dimanche 23h59 Paris de la semaine cible
3. Vérifie que la semaine n'est pas déjà clôturée
4. Calcule masse salariale via fenêtre paie post-dim
5. Calcule bénéfice net = CA - dépenses - masse salariale
6. Écrit `/semaines/{weekKey}` avec statut `cloturee-manuelle`, traces `cloturePar`, `dateClotureManuelle`, `noteCloture`
7. Pose `weekKeyAttribuee` sur les paies de la fenêtre
8. **Snapshot estimations paies** (idem cron étape 1)
9. **Snapshot onglet Sheet** (idem)
10. Régénère Dashboard

**Timezone trick** : utilise `toParisWall` / `parisWallToUtcGlobal` pour gérer correctement les bornes Paris vs UTC.

---

### `marquerPaieVersee` — Checkbox Versé ? sur `/rh`

**Méthode** : POST
**Auth** : Bearer + rôles `['patron', 'co-patron', 'drh', 'admin-technique']`

**Body** :
```json
{
  "snapshotId": "2026-05-11_<uid>",
  "paye": true | false,
  "paieMatcheeId": "<paieDocId>" | null     // optionnel : lie à une paie /paies
}
```

**Actions** :
- Vérifie permissions (direction OU DRH)
- Met à jour `/paiesEstimees/{snapshotId}` :
  - `paye: true/false`
  - `datePaiement: serverTimestamp() | null`
  - `paieMatcheeId`, `paieMatcheeMontant` (si lié)
  - `majPar`, `majParNom`, `dateMaj`
- Idempotent (re-cocher = noop)

---

### `reclasserDepense` — Patron valide/change classification d'une dépense

**Méthode** : POST
**Auth** : Bearer + direction

**Body** :
```json
{
  "depenseId": "...",
  "deductible": true | false,
  "categorie": "matieres-premieres",
  "raisonClassification": "Fournisseur LTD - revente clients",
  "memoriserPattern": { "id": "fournisseur-ltd", "matchType": "boutique", "matchValue": "N°215" },  // optionnel
  "noteAudit": "..."
}
```

**Actions** :
- Vérifie permissions
- Met à jour la dépense (`deductible`, `type`, `valideParPatron: true`)
- Si `memoriserPattern` → ajoute le pattern dans `/config/global.fournisseurs` pour automatisation future
- Trace dans `/depenses/{id}/historique`

---

### `gererEngagement` — CRUD engagements de remboursement

**Méthode** : POST
**Auth** : Bearer + direction

**Body** :
```json
{
  "action": "create" | "update" | "rembourser" | "annuler",
  "id": "...",
  "beneficiaire": "Governor of San Andreas (IRS)",
  "signataire": "Abraham THORPE",
  "objet": "Subvention essence W19",
  "type": "subvention",
  "montantInitial": 300000,
  "dateEcheance": "2026-06-11"
}
```

**Actions** :
- Selon `action`, crée / met à jour / passe en `rembourse` / `annule`
- Trace les remboursements partiels

---

### `refreshDashboardNow` — Refresh Dashboard à la demande

**Méthode** : POST
**Auth** : Bearer + direction
**Secrets** : `[DASHBOARD_SA_KEY]`
**Timeout** : 120s, Memory 512MiB

**Actions** :
1. `regenererDashboard({ db, sheets })` — recalcule toutes les sections Dashboard
2. `forceRefreshImportData({ sheets })` — modifie le param `&_t=` des formules IMPORTDATA pour casser le cache (~1h)
3. Retourne `{ ok: true, rowCount, requestsCount, importdata: {...} }`

---

### `comptaExport` — Endpoint CSV pour IMPORTDATA Sheets

**Méthode** : GET
**Auth** : Query param `?token=<COMPTA_TOKEN secret>`
**Secrets** : `[COMPTA_TOKEN]`
**CORS** : activé (Google Sheets fait des requêtes cross-origin)

**Query** :
- `type=depenses` → CSV dépenses semaine en cours
- `type=ventes` → CSV ventes (source=discord) semaine en cours
- `type=banque` → CSV mouvements bancaires (à voir si toujours utilisé)
- ~~`type=resume`~~ retiré v1.7.0 (cas commenté)
- ~~`type=paies`~~ retiré v1.7.0 (cas commenté)

**Retour** : CSV UTF-8 avec BOM, charset utf-8

**Filtre semaine** : `weekRangeRPParis()` retourne bornes [lun 00h, dim 23h59.999] Paris pour la semaine en cours.

---

### `migrateUsername` — Migration username (outil)

**Méthode** : POST
**Auth** : Bearer + admin-tech

**Body** : `{ uid, newUsername }`

**Actions** : modifie le username Firebase Auth d'un user (utilisé lors de migrations)

---

### `adminResetPassword` — Reset password d'un user

**Méthode** : POST
**Auth** : Bearer + direction OU admin-tech

**Body** : `{ uid, newPassword }`

**Actions** : Admin SDK reset password (sans envoi email)

---

## 📦 Modules backend (`lib/`)

### `lib/dashboard-core.mjs` (~990 lignes)

**Exporté** : `regenererDashboard({ db, sheets, verbose })`

**Fonction** : génère TOUT le contenu de l'onglet `📊 Dashboard`.

**Sections produites** :
- Bandeau titre `🤠 LTD SANDY SHORES — TABLEAU DE BORD COMPTABLE`
- Sous-titre `Conforme TTE Chapitre IV — Secteur 2`
- Horodatage généré
- 6 KPI cards (CA, charges, résultat, masse, bénéfice, impôt)
- 3 KPI bas (subventions, trésorerie, solde opérationnel)
- **Bandeau full-width Bénéfice net cumulé depuis reprise** (vert/rouge)
- Section ENGAGEMENTS DE REMBOURSEMENT
- Section CONFORMITÉ TTE — Échéances (3 lignes)
- 5 dernières ventes + 5 dernières dépenses (cote à cote)
- HISTORIQUE DES SEMAINES (10 dernières)
- Footer audit IRS

**Pipeline** :
1. `chargerDonnees(db)` — lit tout Firestore (ventes, dépenses, paies, redis, semaines, subventions, engagements, banque)
2. `buildDashboard(data)` — construit le tableau `rows[]` (40+ lignes × 9 cols)
3. Effacement onglet (unmerge + clear)
4. `values.update` USER_ENTERED
5. `buildFormatRequests(sheetId, rows)` — génère ~117 requêtes batchUpdate (couleurs, fusions, padding, fontes)
6. Apply par batches de 30

---

### `lib/snapshot-sheet-semaine.mjs` (~620 lignes)

**Exporté** : `snapshotSheetSemaine({ db, sheets, weekKey, weekDebut, weekFin, semaineData })`

**Fonction** : crée/MAJ l'onglet `Semaine N (jj-jj mois aaaa)` pour une semaine donnée.

**Contenu produit** :
- Bandeau titre rouge sang + sous-titre `S20 2026 — du 11/05 au 17/05`
- Horodatage `Snapshot figé le lundi 18 mai 2026 à 02h49`
- 3 KPI cards : CA TOTAL / CHARGES DÉDUCTIBLES / BÉNÉFICE NET
- Section VENTES (filtre `source==='discord' && !annulee`)
- Section DÉPENSES (filtre `type !== 'paie'`)
- Section PAIES (fenêtre lun N+1 → mar N+1 21h, filtrée `weekKeyAttribuee==weekKey`)
  - Colonnes : Date, Payeur, Bénéficiaire, **ID Discord bénéf.**, Montant, Période
- Footer "Snapshot figé — Toute modification ultérieure des collections n'est PAS répercutée ici. Pour audit IRS."

**Idempotent** : si l'onglet existe (même titre) → réutilise sheetId, status `'updated'`. Sinon `addSheet`, status `'created'`. tabColor rouge sang.

---

### `lib/paie-calc.mjs`

**Exportés** :
- `calculerPaieEstimee({ user, ventes, redistributions, semaine })` — calcule le montant estimé pour 1 employé
- `snapshotPaiesEstimees({ db, FieldValue, Timestamp, weekKey, debut, fin })` — pose les snapshots pour TOUS les employés actifs

**Snapshot** :
```js
/paiesEstimees/{weekKey}_{userId} = {
  userId, weekKey, role, prenom, nom,
  montantEstime, ca, caParticulier, bidons, caoutchoucs,
  paye: false, datePaiement: null,
  paieMatcheeId: null, paieMatcheeMontant: null,
  createdAt: serverTimestamp()
}
```

**Idempotence** : ID stable `{weekKey}_{userId}` + skip si exists.

---

### `lib/refresh-importdata.mjs`

**Exporté** : `forceRefreshImportData({ sheets })`

**Fonction** : Trouve toutes les cellules contenant `=IMPORTDATA(...)` dans les onglets `Ventes` / `Depenses`, et modifie le param `&_t=<timestamp>` pour casser le cache Google Sheets (~1h).

---

### `lib/week-iso.mjs`

**Exportés** :
- `weekIsoNumber(date)` — retourne le N° ISO 8601 (1-53)
- `weekIsoLabel(weekKey, { full?, long? })` — formats :
  - `'S20 2026'` (court)
  - `'S20 2026 (11/05 → 17/05)'` (full)
  - `'Semaine 20 du lundi 11/05 au dimanche 17/05/2026'` (long)
- `snapshotSheetTitle(weekKey, debut, fin)` — titre d'onglet `'Semaine 20 (11-17 mai 2026)'`

---

## 🔧 Helpers internes (dans `index.js`)

### Timezone Paris
- `toParisWall(d)` — convertit UTC → "horloge Paris" (Date dont les composantes UTC = Paris)
- `parisWallToUtcGlobal(parisWall)` — inverse
- `weekRangeRPParis()` — bornes lun 00h00 → dim 23h59.999 Paris pour la semaine en cours

### Date / CSV
- `dateIso(ts)` — format `yyyy-MM-dd HH:mm:ss` Paris
- `dateOnly(ts)` — format `yyyy-MM-dd` Paris
- `csvEscape(v)`, `csvRow(...cells)` — sérialisation CSV

### Users
- `loadUsersByDiscordMap()` — map `{ discordId -> 'Prénom NOM' }`
- `resolveUserLabel(raw, usersByDiscord)` — résout `<@123>` → nom
- `cleanNomBot(raw)` — vire les `<@discordId>` parasites

### TTE primes
- `primeHebdoFromCa(ca)` — tranches CA → 0/5k/10k/15k (Art. 4-1.10)
- `primeMensuelleFromBenefice(b)` — tranches bénéfice → 0/20k/40k/60k (Art. 4-1.11)
- `tranchesImpot(benefice)` — calcule tranche + taux + montant impôt (Art. 4-3.2)

### Auth
- `requireDirection(req)` — vérifie Bearer token + role ∈ {patron, co-patron, admin-technique}
- (le DRH n'est PAS dans `requireDirection` — il a son propre check inline dans certaines functions)

### Sheets client
- `getSheetsClient()` — initialise client Google Sheets avec service account depuis `DASHBOARD_SA_KEY` secret
