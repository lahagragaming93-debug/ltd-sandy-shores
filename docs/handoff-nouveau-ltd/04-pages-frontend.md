# 04 — Pages frontend — détail page par page

> Inventaire de chaque page HTML/JS du site, avec : rôles autorisés, sections, KPI affichés, actions disponibles, dépendances API.

Permissions définies dans `public/js/utils/permissions.js`. ACL serveur dans `firebase/firestore.rules`.

---

## 🔐 `index.html` — Login / Création de compte

**Fichier JS** : `public/js/auth.js` (logique transversale, pas de `pages/index.js`)
**Rôles** : Public (pas d'auth requise)

**Sections** :
- Formulaire Login (email + password)
- Formulaire "Créer un compte patron" (apparaît seulement si DB vide)
- Lien "Mot de passe oublié" → Firebase Auth reset

**Logique spéciale** :
- Si `/users` est vide, le premier compte créé est automatiquement `role: 'patron'`, `actif: true`, `compteEnFinance: true`
- Sinon, signup public désactivé (création passe par Admin)

---

## 📊 `dashboard.html` — Dashboard direction

**Fichier JS** : `public/js/pages/dashboard.js` (426 LOC)
**Rôles** : `dashboard` permission = `[...DIRECTION, 'drh', 'responsable-vente', 'responsable-pompiste', ...SUPER_ADMINS]`

**Sections** :
- Bandeau alertes urgentes (rouge si présentes)
- Filtre période (semaine/mois/30j/ouverture/personnalisé + semaines historiques)
- KPI grid : CA, dépenses, masse salariale, bénéfice net, stations, banque, stocks
- Graphiques : ventes/jour, top vendeurs, etc.

**API utilisée** : `listVentesSemaine`, `listDepensesSemaine`, `listPaiesSemaine`, `listenStations`, etc.

---

## 💰 `comptabilite.html` — Page comptabilité

**Fichier JS** : `public/js/pages/comptabilite.js` (1222 LOC — la plus grosse)
**Rôles** : `comptabilite` = `LECTURE_COMPTA` = direction + DRH + admin-tech. `comptabilite_edit` = direction + admin-tech seulement.

**Sections** :
- KPI semaine en cours : CA, dépenses, masse salariale, bénéfice net
- Bouton 🔒 **Clôturer la semaine précédente** (direction + admin-tech, masqué pour DRH)
- Bouton 🔄 **Rafraîchir doc compta** (refresh Dashboard Sheet + cache-bust IMPORTDATA)
- Liste des dépenses semaine avec :
  - Badge classification (validé / suggestion / à classifier)
  - Bouton 🔄 reclasser (modal éditer catégorie + déductible + mémoriser pattern)
- Saisie dépense manuelle (modal)
- Section "Engagements de remboursement" (read seulement, CRUD dans Admin)

**Actions clés** :
- `cloturerSemaine` (Cloud Function) — coche IRS obligatoire
- `reclasserDepense` (Cloud Function) — direction valide/change classification

---

## 👥 `rh.html` — Ressources humaines

**Fichier JS** : `public/js/pages/rh.js` (660 LOC)
**Rôles** : `rh` = `RH_FULL` = direction + DRH + admin-tech

**Sections** :
- **Sélecteur semaine** (composant `semaine-selector.js`) — courante ou historique
- Badge semaine + label "À PAYER" si historique
- KPI grid : Effectif, Salaires estimés, Salaires versés, Masse salariale (% CA), Reste à verser
- Filtres : rôle, statut, recherche
- Table effectif :
  - Nom, Rôle, ID Discord, Heures, CA/Quota, Salaire estimé, Statut, Actions
  - **Colonne Versé ?** (checkbox) si semaine historique (mode snapshot)
  - Bouton 👁 ouvre détail employé (modal)
- Section "Activité de la semaine" : top vendeurs, alertes RH

**Modes** :
- **Live** (semaine en cours) : calcul direct depuis ventes/paies temps réel
- **Snapshot** (semaine clôturée) : lecture `/paiesEstimees`, colonne Versé activée

---

## 💵 `ventes.html` — Ventes

**Fichier JS** : `public/js/pages/ventes.js` (299 LOC)
**Rôles** : `ventes` = direction + DRH + responsable-vente + vendeurs + admin-tech

**Sections** :
- **Sélecteur semaine** (composant `semaine-selector.js`)
- Filtres : vendeur, paiement (especes/carte), recherche
- Bouton 📤 Export CSV
- Table factures :
  - Date, #Facture, Vendeur, Client, Montant, Bénéfice, Paiement, Raison, Vérif, Source, Actions
  - Bouton ✏ Modifier (live) ou 🔒 disabled (semaine clôturée = lecture seule)
- Section "Discordances vente ↔ stock" (alertes anti-fraude)

---

## 👤 `employee.html` — Espace personnel employé

**Fichier JS** : `public/js/pages/employee.js` (907 LOC)
**Rôles** : `employee` = tout user authentifié (chacun voit le sien)
**Mode débug** : `?asUser=<uid>` accessible direction + DRH + admin-tech (lecture seule)

**Sections** (selon rôle) :
- Bandeau bienvenue + boutons actions (déclarer vente, ravitailler, déclarer caoutchoucs)
- Panel "Heures de service" (3 KPI : jour, semaine, cumul)
- **Sélecteur semaine** (composant `semaine-selector.js`) sur panel "Détail de ta semaine"
- Section vendeur : CA total, CA particulier (commissionnable), bénéfice, ventes
- Section pompiste : bidons, caoutchoucs, quotas, score
- Section direction/resp : CA bonus
- Section non-déclarées (vendeur) : factures IG remontées par le bot mais pas encore détaillées
- Section avertissements RH

---

## ⛽ `stations.html` — Stations-essence

**Fichier JS** : `public/js/pages/stations.js` (539 LOC)
**Rôles** : `stations` = direction + DRH + responsable-pompiste + pompistes + admin-tech

**Sections** :
- Tableau 8 stations avec : pompes (stock/prix), stocks bidons/caoutchoucs
- Alertes stock faible (rouge)
- Bouton 🛢 Ravitailler une station (modal pompiste)
- Bouton 🪖 Déclarer caoutchoucs (lien)
- Bouton 📐 Corriger un stock (responsable + direction)
- Historique des ravitaillements

---

## 📦 `stocks.html` — Stock épicerie

**Fichier JS** : `public/js/pages/stocks.js` (684 LOC)
**Rôles** : `stocks` = direction + DRH + responsable-vente + vendeurs (lecture) + admin-tech

**Sections** :
- Catalogue produits avec catégories (nourriture, boisson, hygiène, matériel)
- Distinction particulier / professionnel (`pourPro`)
- Stocks actuels + seuils d'alerte
- Décompte ventes par produit (filtre semaine)
- Ajustement stock manuel (direction + responsable)
- Lien vers vendeur si stock manquant (deeplink `/rh?q=<nom>`)

---

## 🏦 `banque.html` — Mouvements compte LTD

**Fichier JS** : `public/js/pages/banque.js` (239 LOC)
**Rôles** : `banque` = direction + DRH + admin-tech

**Sections** :
- KPI : Solde actuel, Entrées période, Sorties période, Net
- Filtre période (composant `period-filter.js`)
- Tableau mouvements (entrées + sorties combinées chronologiquement)
- Tag subvention (badge si `categorieEntree: 'subvention'`)

---

## 💸 `paies.html` — Mes paies (vue employé)

**Fichier JS** : `public/js/pages/paies.js` (123 LOC)
**Rôles** : tout employé authentifié (chacun voit les siennes)

**Sections** :
- Historique paies reçues (date, payeur, montant, période)
- Filtre période
- Total cumulé sur la période

---

## ⛽ `revenus-carburant.html` — Détail revenus essence

**Fichier JS** : `public/js/pages/revenus-carburant.js` (344 LOC)
**Rôles** : `revenus-carburant` = direction + DRH + responsable-pompiste + admin-tech

**Sections** :
- Filtre période
- Ventilation par station, par pompiste, par jour
- KPI total revenus carburant

---

## 🛠 `admin.html` — Panneau administration

**Fichier JS** : `public/js/pages/admin.js` (1511 LOC — la deuxième plus grosse)
**Rôles** : `admin` = direction + admin-tech (PAS DRH)

**Sections** :
- **Gestion users** : créer, éditer, désactiver, reset password, changer rôle
- **Mapping fournisseurs** : CRUD patterns (label, match, catégorie, déductible)
- **Engagements de remboursement** : CRUD dettes/subventions
- **Config globale** : quotas pompiste, prix carburant, fivemPompesMap, etc.
- **Tools tech** : refresh dashboard, ajustement stock urgence, marquer subvention

---

## 📖 `guide.html` — Guide intégré

**Fichier JS** : `public/js/pages/guide.js` (205 LOC)
**Rôles** : `guide` = tout user authentifié (mais TOC filtré par rôle)

**Sections** :
- Sidebar TOC avec 11 chapitres (certains masqués pour rôles non autorisés : compta, TTE)
- Article markdown rendu via marked.js
- Bouton 🖨 Imprimer / PDF
- Estimation temps de lecture
- Deep-links `?guide=xx-yyy`
- Navigation interne entre chapitres (liens `xx-fichier.md` interceptés)

**Restriction** : `acces: ['patron', 'co-patron', 'drh', 'admin-technique']` sur `09-comptabilite` et `10-tte-reference` → masqué du TOC + bloqué via URL directe

---

## 🔧 `decouverte-items.html` — Outil tech items non mappés

**Fichier JS** : `public/js/pages/decouverte-items.js` (208 LOC)
**Rôles** : direction + admin-tech (outil de maintenance)

**Sections** :
- Liste items FiveM remontés par le bot non présents dans le catalogue produits
- Permet d'ajouter rapidement un mapping item → produit
- Utilisé pour rattraper les items oubliés (alias snake_case)

---

## 🧩 Composants réutilisables

### `period-filter.js`
Sélecteur de période standard avec options :
- Cette semaine, Semaine dernière, Ce mois, 30j, Depuis ouverture, Personnalisé
- + Optgroup "📅 Semaines clôturées" injecté dynamiquement (via `injectSemainesHistoriques()`)
- Usage : `<div>${renderPeriodFilter('semaine')}</div>` + `attachPeriodFilter(callback)`

### `semaine-selector.js`
Sélecteur de semaine (courante + N dernières clôturées) :
- Format `Semaine 20 du lundi 11/05 au dimanche 17/05/2026`
- Persistance sessionStorage
- Livre payload `{weekKey, debut, fin, statut, statutLabel, isCurrent, semaine}` au callback
- Utilisé sur `/rh`, `/ventes`, `/employee`

### `sortable-table.js`
Tri colonnes `<table>` au clic header
Usage : `makeSortable(document.getElementById('table-xxx'))`

### `vente-modal.js`
Modal déclaration / édition de vente avec recherche produits, calcul auto, validation TTE

### `toast.js`
Notifications UI : `toastSuccess('msg')`, `toastError('msg')`

### `formatters.js`
Helpers display : `money(n)`, `num(n)`, `datetime(d)`, `weekIsoLabel(weekKey)`, `weekRangeFromKey(weekKey)`, etc.

### `paie.js`
Calcul salaire :
- `salaireVendeur(role, caParticulier)` — commission selon grade
- `salairePompiste(role, bidons, caoutchoucs)` — fixe + bonus quota
- `salaireEstime(user, metrics)` — wrapper
- `scorePompiste(bidons, caoutchoucs, quotaBidons, quotaCaoutchoucs)` — score %
- `checkMasseSalariale(masse, ca)` — alerte si > 90%

### `permissions.js`
ACL côté client :
- `isDirection(role)` — patron ou co-patron
- `isVendeur(role)` — vendeur-novice/intermediaire/experimente
- `isPompiste(role)` — pompiste-...
- `isResponsable(role)` — responsable-vente / responsable-pompiste
- `isSuperAdmin(role)` — admin-technique
- `compteEnFinance(role)` — apparaît dans masse salariale
- `ROLE_LABELS` — mapping rôle → label affichable
- `PLAFOND_SALAIRE` — mapping rôle → plafond TTE
- `CA_PLAFOND_VENDEUR`, `COMMISSION_VENDEUR` — tranches paie vendeur

---

## 🎨 Layout & Navigation

**Fichier** : `public/js/layout.js`

**Sidebar** : 
- Sections : Direction, Opérations, Finance, Personnel, Système, Aide
- Items affichés conditionnellement selon rôle
- Logo + nom LTD en haut
- Profile user + version BLATV en bas

**Top bar** :
- Bouton retour ← (mobile)
- Titre page
- Notifications (cloche) + dropdown alertes
- Profile avatar + badge rôle

---

## 🔒 Authentification (transversal)

**Fichier** : `public/js/auth.js`

**Fonctions clés** :
- `requireAuth(pageId)` — vérifie session + rôle, redirige si pas autorisé
- `getCurrentUser()` — retourne `firebase.auth().currentUser`
- `signOut()` — logout

Toutes les pages JS commencent par `const { profile } = await requireAuth('xxx');` qui :
1. Vérifie qu'un user est authentifié
2. Lit son rôle depuis `/users/{uid}`
3. Compare aux permissions de la page (`PERMISSIONS[pageId]`)
4. Redirige vers `/login` ou `/index` si non autorisé
5. Retourne le profil pour utilisation dans la page
