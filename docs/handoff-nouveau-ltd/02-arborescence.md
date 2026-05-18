# 02 — Arborescence complète du repo

> Snapshot v1.7.0. Met à jour ce doc si tu ajoutes/supprimes des fichiers.

```
LTD Sandy Shores/                          ← racine repo
├── README.md                              Présentation projet (à rebrand)
├── LIENS.md                               Raccourcis URLs utiles (Firebase Console, Sheet, etc.)
├── .gitignore                             Ignore : node_modules, secrets, .claude/, etc.
├── IDENTIFIANTS-BATCH-2026-05-11.txt      ⚠ Gitignored, identifiants employés en vrac
│
├── .github/                               Workflows GitHub Actions (si configurés)
│
├── public/                                ━━━━━━━━━━━ FRONTEND (servi GitHub Pages) ━━━━━━━━━━━
│   │
│   ├── index.html                         Login + création compte patron (page d'accueil)
│   ├── dashboard.html                     Dashboard direction (KPI multi-secteurs)
│   ├── comptabilite.html                  Page compta + bouton 🔒 clôture + classification dépenses
│   ├── rh.html                            RH + snapshots paies + Versé ? + sélecteur semaine
│   ├── ventes.html                        Ventes (semaine en cours + sélecteur historique)
│   ├── employee.html                      Espace perso employé (vendeur/pompiste)
│   ├── stations.html                      Stations-essence (stocks, ravitaillement, alertes)
│   ├── stocks.html                        Stock épicerie (avec alertes seuils)
│   ├── banque.html                        Mouvements compte LTD (entrées + sorties + solde)
│   ├── paies.html                         Mes paies (vue employé : historique perso)
│   ├── revenus-carburant.html             Détail revenus essence (direction + responsable pompiste)
│   ├── admin.html                         Panneau admin (config, users, fournisseurs, engagements)
│   ├── guide.html                         Guide intégré (markdown rendu, 11 chapitres)
│   ├── decouverte-items.html              Outil tech : items FiveM non mappés dans le catalogue
│   │
│   ├── css/
│   │   └── western.css                    1899 lignes — Palette saloon, layout, composants
│   │
│   ├── img/
│   │   ├── logo.png                       Logo LTD (sidebar, login) — À REMPLACER
│   │   └── favicon.png                    Favicon onglet navigateur — À REMPLACER
│   │
│   ├── js/                                ━━ Logique frontend ━━
│   │   │
│   │   ├── firebase-config.js             ⚠ Clés Firebase (apiKey, authDomain, projectId, ...)
│   │   ├── auth.js                        Login, requireAuth, mode "Voir comme" (?asUser=)
│   │   ├── api.js                         Wrapper Firestore queries (~25 fonctions exportées)
│   │   ├── layout.js                      Sidebar dynamique selon rôle, footer, version
│   │   ├── version.js                     ⚠ VERSION + AUTHOR (à customiser)
│   │   │
│   │   ├── pages/                         1 fichier par page HTML
│   │   │   ├── dashboard.js               426 LOC
│   │   │   ├── comptabilite.js            1222 LOC — la plus grosse
│   │   │   ├── rh.js                      660 LOC
│   │   │   ├── ventes.js                  299 LOC
│   │   │   ├── employee.js                907 LOC
│   │   │   ├── stations.js                539 LOC
│   │   │   ├── stocks.js                  684 LOC
│   │   │   ├── banque.js                  239 LOC
│   │   │   ├── paies.js                   123 LOC
│   │   │   ├── revenus-carburant.js       344 LOC
│   │   │   ├── admin.js                   1511 LOC
│   │   │   ├── guide.js                   205 LOC
│   │   │   ├── decouverte-items.js        208 LOC
│   │   │
│   │   ├── modules/                       Modales et composants réutilisables (vente-modal, etc.)
│   │   │
│   │   └── utils/
│   │       ├── permissions.js             ACL : DIRECTION, VENDEURS, RH_FULL, isVendeur(), etc.
│   │       ├── paie.js                    Calcul salaire vendeur/pompiste, plafonds, primes
│   │       ├── formatters.js              money(), num(), datetime(), weekIsoLabel(), weekRangeFromKey()
│   │       ├── period-filter.js           Sélecteur période réutilisable (5+ pages)
│   │       ├── semaine-selector.js        Sélecteur semaine factorisé (RH, Ventes, Employee)
│   │       ├── sortable-table.js          Tri colonnes <table>
│   │       ├── toast.js                   Notifications (success/error)
│   │       ├── vente-modal.js             Modal déclaration/édition vente
│   │       └── ...
│   │
│   └── guide/                             ━━ Guide utilisateur (markdown) ━━
│       ├── 00-index.md                    Sommaire des guides
│       ├── 01-direction.md                Pour patron / co-patron
│       ├── 02-drh.md                      Pour DRH
│       ├── 03-responsable-vente.md        Pour responsable vente
│       ├── 04-responsable-pompiste.md     Pour responsable pompiste
│       ├── 05-vendeur.md                  Pour vendeurs
│       ├── 06-pompiste.md                 Pour pompistes
│       ├── 07-automatismes.md             Crons et automatismes (technique léger)
│       ├── 08-faq-depannage.md            FAQ + dépannage
│       ├── 09-comptabilite.md             Compta + clôture (accès restreint direction+DRH+admin)
│       └── 10-tte-reference.md            Réf TTE intégrale (accès restreint)
│
├── firebase/                              ━━━━━━━━━━━ BACKEND ━━━━━━━━━━━
│   │
│   ├── firebase.json                      Config deploy (functions + firestore rules)
│   ├── firestore.rules                    Règles ACL Firestore (read/write par rôle)
│   ├── firestore.indexes.json             Indexes composites Firestore
│   ├── serviceAccountKey.json             ⚠ GITIGNORED — clé service account JSON
│   ├── .firebaserc                        ⚠ GITIGNORED — project ID Firebase
│   │
│   └── functions/
│       │
│       ├── index.js                       ━━ 4172 LIGNES — TOUTES les Cloud Functions ━━
│       │                                  Crons (clotureHebdo, clotureHebdoPaies, ...)
│       │                                  HTTP (botIngest, declarerVente, cloturerSemaine, ...)
│       │                                  Helpers (csvVentes, csvDepenses, csvPaies, ...)
│       │
│       ├── package.json                   firebase-admin, firebase-functions, googleapis
│       ├── package-lock.json
│       ├── node_modules/                  GITIGNORED
│       │
│       ├── lib/                           ⚠ GITIGNORED par défaut (force-add nécessaire)
│       │   ├── dashboard-core.mjs         Génération onglet 📊 Dashboard du Sheet (~990 lignes)
│       │   ├── snapshot-sheet-semaine.mjs Onglet Semaine N (jj-jj mois aaaa) à la clôture
│       │   ├── paie-calc.mjs              Snapshot estimations paie à la clôture (Option B)
│       │   ├── refresh-importdata.mjs     Cache-bust IMPORTDATA des formules Sheet
│       │   └── week-iso.mjs               Helpers weekIsoNumber/weekIsoLabel/snapshotSheetTitle
│       │
│       └── scripts/                       ━━ 15 scripts CLI utilitaires ━━
│           ├── backup-complet.js          Backup complet Firestore → JSON local
│           ├── force-refresh-dashboard.js Appelle refreshDashboardNow en local
│           ├── force-refresh-sheet.js     Casse cache IMPORTDATA des onglets Sheet
│           ├── format-sheet.js            Formatage des onglets live (Ventes/Dépenses)
│           ├── init-engagements.js        Bootstrap dettes / subventions à rembourser
│           ├── init-fournisseurs-mapping.js  Bootstrap mapping fournisseurs → déductibilité
│           ├── init-stations.js           Bootstrap stations + pompes + prix carburant
│           ├── init-stocks.js             Bootstrap catalogue produits + stocks initiaux
│           ├── list-fournisseurs-config.js   Liste config fournisseurs (read-only)
│           ├── list-produits-pour-parser.js  Liste produits formatée pour le bot
│           ├── list-users.js              Liste users Firestore (read-only)
│           ├── list-ventes-intervalle.js  Ventes sur intervalle de dates (read-only)
│           ├── list-ventes-vendeur.js     Ventes d'un vendeur (read-only)
│           ├── refaire-dashboard-pro.js   Régénération Dashboard en local (debug + fix prod)
│           └── resync-stocks.js           Resync stocks depuis logs FiveM (rattrapage)
│
├── discord-bot/                           ━━━━━━━━━━━ BOT DISCORD ━━━━━━━━━━━
│   │
│   ├── README.md                          Setup bot
│   ├── index.js                           Router events Discord → parsers
│   ├── package.json                       discord.js v14, firebase-admin
│   ├── package-lock.json
│   ├── node_modules/                      GITIGNORED
│   ├── config.json                        ⚠ GITIGNORED — token + canal IDs + botIngestUrl
│   ├── .env                               ⚠ GITIGNORED — alternatif config (selon impl)
│   │
│   ├── parsers/                           1 parser par type d'embed FaabHook
│   │   ├── facture.js                     #facturation-ig → /ventes
│   │   ├── depense.js                     #depenses → /depenses
│   │   ├── paie.js                        #paie → /paies
│   │   ├── ravitaillement.js              #logs-ig (essence) → /stations
│   │   └── ... (cf 07-discord-bot.md pour la liste complète)
│   │
│   └── scripts/                           Utilitaires bot (resync, debug)
│
└── docs/                                  ━━━━━━━━━━━ DOCUMENTATION ━━━━━━━━━━━
    │
    ├── JOURNAL.md                         ⭐ Journal chronologique session par session
    ├── ROADMAP.md                         ⭐ Chantiers en cours / à surveiller / résolus
    ├── TTE-complet.txt                    Référence TTE brute (12 chapitres)
    │
    ├── 01-setup-firebase.md               Doc setup Firebase pour passation
    ├── 02-setup-discord-bot.md            Doc setup bot
    ├── 03-setup-github-pages.md           Doc setup hosting
    ├── 04-premier-compte.md               Bootstrap premier patron
    ├── 05-permissions.md                  Schema ACL
    ├── 06-architecture.md                 Diagramme flux + collections Firestore
    ├── 07-transmission.md                 Passation au vrai patron RP
    │
    └── handoff-nouveau-ltd/               ⭐ CE DOSSIER — Bootstrap nouveau LTD
        ├── 00-INDEX.md
        ├── 01-vision-et-stack.md
        ├── 02-arborescence.md             (toi)
        ├── 03-features.md
        ├── 04-pages-frontend.md
        ├── 05-cloud-functions.md
        ├── 06-firestore-schema.md
        ├── 07-discord-bot.md
        ├── 08-google-sheets.md
        ├── 09-permissions-acl.md
        ├── 10-tte-rules.md
        ├── 11-setup-pas-a-pas.md
        ├── 12-personnalisation-da.md
        ├── 13-scripts-cli.md
        ├── 14-pieges-known-issues.md
        ├── 15-glossaire-rp.md
        ├── 16-pour-claude-suivant.md
        └── _ARCHIVE-handoff-v1-monobloc.md  (référence rapide condensée)
```

## 📏 Volumétrie code

| Catégorie | LOC |
|---|---|
| Frontend (pages) | ~7800 LOC JS |
| Frontend (utils) | ~1500 LOC JS |
| Frontend (HTML) | ~15 fichiers, ~50-200 LOC chacun |
| Frontend (CSS) | 1899 LOC |
| Backend (index.js) | 4172 LOC |
| Backend (lib/) | ~2000 LOC (5 modules) |
| Backend (scripts/) | ~2000 LOC (15 scripts) |
| Bot Discord | ~1500 LOC (10+ parsers) |
| Docs guide | ~3000 LOC markdown (11 fichiers) |
| Docs interne | ~2000 LOC (JOURNAL, ROADMAP, handoff) |
| **TOTAL** | **~25 000 LOC** |

## 🗃 Fichiers à NE JAMAIS commit

Listés dans `.gitignore` :
- `node_modules/` (auto)
- `firebase/serviceAccountKey.json`
- `firebase/.firebaserc`
- `firebase/functions/lib/` (sauf force-add `git add -f lib/<file>.mjs`)
- `firebase/functions/.runtimeconfig.json`
- `discord-bot/config.json`
- `discord-bot/.env`
- `*.token`, `*.secret`, `*.credentials.json`
- `IDENTIFIANTS-*.txt`
- `backup-*.json`
- `.claude/`
- `.vscode/`, `.idea/`

⚠ Avant chaque push, vérifier `git status` pour s'assurer qu'aucun secret n'est en attente.
