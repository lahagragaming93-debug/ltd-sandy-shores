# 📦 HANDOFF — Bootstrap d'un nouveau LTD à partir du squelette Sandy Shores

> **À lire en premier par une nouvelle conversation Claude.** Ce document est self-contained : tout ce qu'il faut savoir pour cloner le projet, ré-héberger, re-brander, et déployer un nouveau LTD (autre nom, autre DA visuelle, mêmes mécaniques de gestion).

**Repo source** : LTD Sandy Shores (FiveM RP, conforme TTE Chapitre IV — Secteur 2).
**Version courante** : `1.7.0` (2026-05-18).
**Auteur original du squelette** : BLATV.

---

## 🎯 1. Vision : à quoi sert ce squelette

Une plateforme web complète de gestion pour un LTD (Local du Travail Détaillant) FiveM, comprenant :

- **Vente au comptoir** (épicerie multisites) + **franchise stations-essence** (pompistes, ravitaillements, quotas)
- **Gestion RP réaliste** alignée sur les règles fiscales du serveur (TTE Sandy Shores, Chapitre IV, Secteur 2)
- **Audit IRS in-game** : Google Sheet partageable au contrôleur fiscal RP avec onglets snapshots semaine par semaine
- **Workflow clôture hebdomadaire** : cron auto le lundi 00h00 + bouton manuel patron
- **Bot Discord** qui parse les logs IG (FaabHook) → enregistre les ventes/dépenses/paies en base
- **Système de paies** : estimations TTE + snapshot figé par semaine + checkbox "Versé"

**Public cible** : le patron RP du LTD (pas un développeur), avec accès à un site web sobre et un Sheet "officiel" qu'il peut montrer au contrôleur IRS.

---

## 🏗 2. Stack technique

| Couche | Tech | Notes |
|---|---|---|
| Frontend | HTML / CSS / JS vanilla + Firebase SDK CDN | Pas de framework. Modules ES6 natifs. |
| Hébergement frontend | **GitHub Pages** | Repo public, branch `main`. Auto-deploy au push. |
| Auth | **Firebase Authentication** | Email/password + first-login = patron |
| Base de données | **Firebase Firestore** | Collections : users, ventes, depenses, paies, semaines, paiesEstimees, banqueLtd, redistributions, stations, stocks, alertes, engagements, config |
| Backend | **Firebase Functions** (Node.js 20, region `europe-west1`) | onRequest (HTTP) + onSchedule (cron) |
| Doc compta | **Google Sheets** via Sheets API | Service account avec key JSON, partage edit sur le doc |
| Bot logs | **Discord bot** Node.js (`discord.js v14`) | Parse FaabHook embeds dans canaux dédiés |
| Versioning | Git + GitHub | Branche unique `main`. |

### Comptes externes à provisionner pour un nouveau LTD

1. **Firebase project** (Google Cloud) — gratuit en plan Spark, mais Functions Gen2 nécessitent Blaze (paiement à l'usage, ~0$/mois pour ce volume)
2. **Google Sheets** : créer un nouveau Sheet, partager en édition avec le service account du Firebase project
3. **Discord** : créer une app + bot, l'inviter sur le serveur RP avec scope `bot` et permissions message-read sur les canaux logs
4. **GitHub** : forker le repo + activer GitHub Pages sur `main` branch, root `/public`
5. **(Optionnel) Domain custom** : pointage CNAME vers `<user>.github.io`

---

## 🗺 3. Arborescence du repo

```
.
├── README.md                          Présentation projet
├── .gitignore                         (node_modules, .env, serviceAccountKey, etc.)
├── public/                            FRONTEND — servi par GitHub Pages
│   ├── index.html                     Login / inscription patron (page d'accueil)
│   ├── dashboard.html                 Dashboard direction
│   ├── comptabilite.html              Compta + bouton clôture manuelle
│   ├── rh.html                        Gestion RH + snapshots paies + Versé ?
│   ├── ventes.html                    Ventes (semaine en cours + sélecteur historique)
│   ├── employee.html                  Espace perso employé
│   ├── stations.html                  Stations-essence (stocks, ravitaillement)
│   ├── stocks.html                    Stock épicerie
│   ├── banque.html                    Mouvements compte LTD
│   ├── paies.html                     Mes paies (vue employé)
│   ├── revenus-carburant.html         Détail revenus essence (direction)
│   ├── admin.html                     Panneau admin (direction + admin-tech)
│   ├── guide.html                     Guide intégré (markdown rendu)
│   ├── decouverte-items.html          Outil tech : items non mappés
│   ├── css/
│   │   └── western.css                THÈME — 1899 lignes, palette saloon
│   ├── img/
│   │   ├── logo.png                   À REMPLACER (DA spécifique)
│   │   └── favicon.png                À REMPLACER
│   ├── js/
│   │   ├── api.js                     Wrapper Firestore (queries)
│   │   ├── auth.js                    Login / requireAuth / mode "voir comme"
│   │   ├── firebase-config.js         À PERSONNALISER (clés Firebase)
│   │   ├── layout.js                  Sidebar + footer + version
│   │   ├── version.js                 VERSION + AUTHOR (à personnaliser)
│   │   ├── pages/                     1 fichier par page (logique)
│   │   ├── modules/                   Modales, composants
│   │   └── utils/
│   │       ├── permissions.js         ACL par rôle (DIRECTION, VENDEURS, ...)
│   │       ├── paie.js                Calcul salaire vendeur/pompiste + score
│   │       ├── formatters.js          money/date/weekIsoLabel/etc.
│   │       ├── period-filter.js       Sélecteur période réutilisable
│   │       ├── semaine-selector.js    Sélecteur semaine (snapshots)
│   │       └── ...
│   └── guide/                         11 fichiers markdown (1 par rôle + faq + tte)
│       ├── 00-index.md
│       ├── 01-direction.md
│       ├── 02-drh.md
│       ├── ...
│       └── 10-tte-reference.md        RÉFÉRENCE TTE intégrale (à actualiser si TTE évolue)
├── firebase/
│   ├── firebase.json                  Config deploy (functions + firestore rules)
│   ├── firestore.rules                Règles ACL Firestore
│   ├── firestore.indexes.json         Indexes composites
│   ├── serviceAccountKey.json         GITIGNORED — clé service account Google
│   └── functions/
│       ├── index.js                   4172 lignes — TOUTES les Cloud Functions
│       ├── package.json
│       ├── lib/                       GITIGNORED par défaut (force-add nécessaire)
│       │   ├── dashboard-core.mjs     Génération onglet 📊 Dashboard
│       │   ├── snapshot-sheet-semaine.mjs   Onglet Semaine N (jj-jj mois)
│       │   ├── paie-calc.mjs          Snapshot estimations paie à la clôture
│       │   ├── refresh-importdata.mjs Cache-bust IMPORTDATA
│       │   └── week-iso.mjs           Helpers weekIsoNumber / weekIsoLabel / snapshotSheetTitle
│       └── scripts/                   ~40 scripts CLI (backfill, debug, init)
│           ├── format-sheet.js        Formatage des onglets live
│           ├── refaire-dashboard-pro.js  Régénération Dashboard local
│           ├── init-stations.js       Bootstrap stations-essence
│           ├── init-stocks.js         Bootstrap stocks initiaux
│           ├── init-fournisseurs-mapping.js   Mapping fournisseurs déductibilité
│           ├── init-engagements.js    Dettes / subventions à rembourser
│           ├── backfill-*.mjs         Backfills ponctuels
│           └── check-*.js, debug-*.js Diagnostics
├── discord-bot/                       BOT DISCORD
│   ├── index.js                       Routeur d'events
│   ├── package.json
│   ├── config.json                    GITIGNORED — token + canal IDs
│   ├── .env                           GITIGNORED — credentials Firestore
│   └── parsers/                       1 parser par type d'embed FaabHook
│       ├── facture.js                 → ventes
│       ├── depense.js                 → depenses
│       ├── paie.js                    → paies
│       ├── ravitaillement.js          → stations
│       └── ...
├── docs/
│   ├── JOURNAL.md                     Journal de bord chronologique (session par session)
│   ├── ROADMAP.md                     Chantiers en cours / résolus / surveillance
│   ├── 01-setup-firebase.md           Doc setup Firebase pour passation
│   ├── 02-setup-discord-bot.md        Doc setup bot
│   ├── 03-setup-github-pages.md       Doc setup hosting
│   ├── 04-premier-compte.md           Bootstrap premier patron
│   ├── 05-permissions.md              Schema ACL
│   ├── 06-architecture.md             Diagramme flux + collections Firestore
│   ├── 07-transmission.md             Passation au vrai patron RP
│   ├── TTE-complet.txt                Référence TTE brute (12 chapitres)
│   └── HANDOFF-NOUVEAU-LTD.md         CE FICHIER
└── sheets-apps-script.js              ⚠ Legacy (Apps Script user) - PAS UTILISÉ en v1.7+
```

---

## ⚙ 4. Inventaire des features (v1.7.0)

### Frontend (pages site)

- **Login / Création de compte patron** (`index.html`) — premier user = patron
- **Dashboard** (`dashboard.html`) — vue d'ensemble RH/finances/stations, KPI temps réel filtrables par période
- **Comptabilité** (`comptabilite.html`) — saisie dépense manuelle, classification déductibilité, bouton 🔒 Clôturer, refresh Sheet
- **RH** (`rh.html`) — effectif, salaires estimés/versés, masse salariale, **sélecteur semaine** (courante OU snapshot historique), checkbox **Versé ?**, KPI **Reste à verser**
- **Ventes** (`ventes.html`) — factures de la semaine, **sélecteur historique**, export CSV
- **Espace employé** (`employee.html`) — dashboard perso (heures, ventes, commission, primes), mode `?asUser=` pour direction
- **Stations** (`stations.html`) — stocks pompes, ravitaillement, alertes
- **Stocks** (`stocks.html`) — épicerie, alertes seuils
- **Banque LTD** (`banque.html`) — mouvements compte (entrées/sorties), solde temps réel
- **Mes paies** (`paies.html`) — historique paies pour un employé
- **Revenus carburant** (`revenus-carburant.html`) — ventilation revenus essence par station
- **Admin** (`admin.html`) — config globale, fournisseurs/déductibilité, gestion users, engagements de remboursement
- **Guide** (`guide.html`) — 11 chapitres MD, restriction par rôle sur §compta + §TTE

### Backend (Cloud Functions HTTP + Cron)

**Cron (onSchedule, Europe/Paris)** :
- `clotureHebdo` — **lundi 00h00** — fige CA + dépenses semaine S-1 (`cloturee-partielle`), crée snapshots `/paiesEstimees`, crée onglet Sheet "Semaine N (jj-jj mois)", renomme onglets live
- `clotureHebdoPaies` — **mardi 21h05** — filet de sécurité : finalise masse salariale + bénéfice net si pas clôturée manuellement
- `verifierSortiesExpirees` — alerte stock anti-vol
- `dashboardKeepAlive` — every-minute check A1, régénère Dashboard si manquant
- `cronAlertesEngagements` — alerte dettes proches échéance

**HTTP (onRequest)** :
- `botIngest` — endpoint POST appelé par le bot Discord pour pousser ventes/dépenses/paies
- `declarerVente`, `modifierVente` — déclarations manuelles vendeur
- `pompisteRavitaillerManuel`, `pompisteCorrigerStock`, `pompisteDeclarerCaoutchoucs` — actions pompiste
- `cloturerSemaine` — bouton 🔒 patron (direction only, validation IRS coche obligatoire)
- `marquerPaieVersee` — checkbox Versé sur /rh (direction + DRH)
- `reclasserDepense` — patron valide/change classification déductibilité
- `gererEngagement` — CRUD dettes/subventions (direction)
- `refreshDashboardNow` — bouton refresh côté UI (direction)
- `comptaExport` — endpoint CSV pour IMPORTDATA Sheets (auth par token)
- `migrateUsername`, `adminResetPassword` — outils admin

### Bot Discord

- Écoute les embeds FaabHook sur canaux configurés (`#facturation-ig`, `#depenses`, `#paie`, `#logs-ig`, etc.)
- Parse chaque embed selon le type (facture, dépense, paie, ravitaillement, etc.)
- POST vers `botIngest` Cloud Function → enregistrement Firestore
- Logs internes + détection items inconnus (à mapper)

### Google Sheet "Comptabilité LTD"

- **📊 Dashboard** — généré côté serveur (Node), refresh manuel ou cron
- **Ventes Semaine N (jj-jj mois)** — live, semaine en cours, IMPORTDATA filtré
- **Dépenses Semaine N (jj-jj mois)** — live, semaine en cours, IMPORTDATA filtré
- **Semaine N (jj-jj mois aaaa)** ×N — onglets snapshot figés à chaque clôture (audit IRS)

---

## 🎨 5. Ce qui change pour un nouveau LTD (DA / branding)

### Fichiers à modifier (configuration spécifique)

| Fichier | Quoi changer | Exemple Sandy Shores → Nouveau |
|---|---|---|
| `public/js/firebase-config.js` | Clés Firebase | apiKey, authDomain, projectId, etc. |
| `public/js/version.js` | VERSION + AUTHOR | `BLATV` → ton signature |
| `public/img/logo.png` | Logo LTD | DA Sandy Shores → DA nouveau LTD |
| `public/img/favicon.png` | Favicon | idem |
| `public/css/western.css` | Palette couleurs | Si la nouvelle DA n'est pas western (ex: futuriste, mafia, etc.) refonte complète |
| `public/index.html` + tous les `.html` | Titre `<title>` + meta | "LTD Sandy Shores" → "Nouveau LTD" |
| `public/js/layout.js` | Nom affiché sidebar | "🤠 SANDY SHORES" |
| `public/guide/*.md` | Textes / exemples | Mentions "Sandy Shores", "Blake MARS", etc. |
| `README.md` | Présentation projet | Nom + description |
| `firebase/.firebaserc` | Project ID Firebase | `ltd-sandy-shores-f3919` → nouveau |
| `firebase/functions/lib/dashboard-core.mjs` | `SHEET_ID` + titre Dashboard | ID du nouveau Sheet + "LTD SANDY SHORES" → nouveau nom |
| `firebase/functions/lib/snapshot-sheet-semaine.mjs` | `SHEET_ID` + titre bandeau | idem |
| `firebase/functions/index.js` | `SHEET_ID_COMPTA` (en haut) | idem |
| `firebase/functions/index.js` | URLs Function dans les commentaires | `europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/...` |
| `public/js/api.js` | URL `marquerPaieVersee` Function | idem |
| `discord-bot/config.json` | Token bot + canal IDs FaabHook | tokens nouveau bot Discord |
| `discord-bot/parsers/*.js` | Canal IDs en dur (s'il y en a) | À vérifier au cas par cas |

### Données métier à reset / re-init

Scripts à lancer dans cet ordre pour un fresh start :

```bash
cd firebase/functions

# 1. Bootstrap stations-essence (ajuster les IDs/positions FiveM dans le script)
node scripts/init-stations.js

# 2. Stocks initiaux épicerie (ajuster catalogue produits)
node scripts/init-stocks.js

# 3. Mapping fournisseurs → déductibilité (selon les fournisseurs RP du nouveau LTD)
node scripts/init-fournisseurs-mapping.js

# 4. (Optionnel) Engagements de remboursement actifs (subventions IRS, dettes initiales)
node scripts/init-engagements.js
```

### Choses qui ne changent PAS (squelette générique)

- **Règles TTE** (`docs/TTE-complet.txt` + `public/guide/10-tte-reference.md`) — identiques pour tous les LTD du serveur Sandy Shores
- **Calcul salaire** (`public/js/utils/paie.js` + `firebase/functions/lib/paie-calc.mjs`) — formule TTE Art. 4-1.7 (CA × commission par grade)
- **Workflow clôture** — même cron lundi 00h00 + bouton patron + mardi 21h05 filet
- **Snapshots paies + onglets Sheet par semaine** — feature audit IRS, valable pour tous les LTD
- **Format embeds FaabHook** — le bot parse les mêmes embeds (sauf si serveur RP change)

---

## 🚀 6. Étapes pour bootstrap un nouveau LTD

> Suis dans l'ordre. Chaque étape débloque la suivante. Compte ~4-6h pour le premier déploiement complet.

### Étape 1 — Provisionner les comptes externes

1. **Firebase Console** : crée un nouveau projet (gratuit), active **Firestore** (mode production, région `europe-west1`), active **Authentication** (Email/Password), active **Functions** (nécessite plan Blaze : carte CB)
2. **Google Cloud Console** (même projet auto-lié) : génère une **clé service account** JSON pour Sheets API. Active l'API Google Sheets
3. **Google Drive** : crée un nouveau Google Sheet vide "Comptabilité LTD [Nom]" et partage-le en édition avec l'email du service account
4. **Discord Developer Portal** : crée une app + bot, copie le TOKEN. Invite-le sur le serveur RP avec scope `bot` + permissions `Read Messages` + `Read Message History` sur les canaux logs (FaabHook)
5. **GitHub** : crée un repo public (ou fork de celui-ci), active GitHub Pages sur `main` branch, root `/public`

### Étape 2 — Cloner et configurer le repo

```bash
git clone https://github.com/<toi>/ltd-nouveau.git
cd ltd-nouveau

# Installer les deps Firebase Functions
cd firebase/functions && npm install && cd ../..

# Installer les deps bot Discord
cd discord-bot && npm install && cd ..

# Login Firebase CLI
firebase login
firebase use --add  # choisir le nouveau projet
```

### Étape 3 — Personnaliser la config (cf. §5 table)

Liste minimale à éditer pour un boot fonctionnel :
- `public/js/firebase-config.js` (clés du nouveau Firebase project)
- `firebase/.firebaserc` (project ID)
- Toutes les occurrences de `1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY` (ancien SHEET_ID) → nouveau
- Toutes les occurrences de `ltd-sandy-shores-f3919` (ancien projectId Firebase) → nouveau
- Toutes les occurrences de `Sandy Shores` / `SANDY SHORES` → nouveau nom (logo, sidebar, titres pages, guides)

```bash
# Cmd utiles pour le rebranding
grep -rl "ltd-sandy-shores-f3919" public/ firebase/ discord-bot/ docs/
grep -rl "1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY" public/ firebase/
grep -rl "Sandy Shores" public/ firebase/ docs/
```

### Étape 4 — Déployer les Cloud Functions

```bash
cd firebase/functions

# Copier la clé service account dans firebase/serviceAccountKey.json
# (gitignored — ne JAMAIS commit)
cp ~/Downloads/<service-account>.json ../serviceAccountKey.json

# Set le secret COMPTA_TOKEN (pour comptaExport)
firebase functions:secrets:set COMPTA_TOKEN
# (générer une chaîne random de 32 chars et la coller)

# Set DASHBOARD_SA_KEY (contenu du service account JSON)
firebase functions:secrets:set DASHBOARD_SA_KEY --data-file ../serviceAccountKey.json

# Deploy
firebase deploy --only "functions,firestore:rules"
```

### Étape 5 — Bootstrap données initiales

```bash
cd firebase/functions

node scripts/init-stations.js          # stations + pompes + prix carburant
node scripts/init-stocks.js            # catalogue produits + stocks initiaux
node scripts/init-fournisseurs-mapping.js   # déductibilité fournisseurs

# (Optionnel) Subvention IRS de démarrage si applicable
node scripts/init-engagements.js
```

### Étape 6 — Premier compte patron

1. Push le repo sur GitHub → GitHub Pages republie
2. Ouvre `https://<toi>.github.io/<repo>/` dans le navigateur
3. Crée un compte avec ton email patron
4. **Manuellement dans Firestore Console**, édite ton user doc :
   - `role: "patron"`
   - `actif: true`
   - `compteEnFinance: true`
   - `prenom: "..."`, `nom: "..."`
5. Recharge le site, tu as accès direction complet

### Étape 7 — Connecter le bot Discord

```bash
cd discord-bot

# Créer config.json avec le token + canal IDs
cat > config.json <<EOF
{
  "discordToken": "<TOKEN_BOT>",
  "guildId": "<ID_SERVEUR_DISCORD>",
  "channels": {
    "facturationIg": "<ID_CANAL>",
    "depenses": "<ID_CANAL>",
    "paie": "<ID_CANAL>",
    "logsIg": "<ID_CANAL>"
  },
  "botIngestUrl": "https://europe-west1-<NOUVEAU_PROJET>.cloudfunctions.net/botIngest",
  "botIngestSecret": "<même valeur que COMPTA_TOKEN ou autre>"
}
EOF

# Lancer le bot
node index.js

# Pour production : déployer sur un VPS / Railway / Fly.io et faire tourner en daemon
```

### Étape 8 — Premier refresh Dashboard + formatage Sheet

```bash
cd firebase/functions

node scripts/refaire-dashboard-pro.js    # crée l'onglet 📊 Dashboard
node scripts/format-sheet.js             # formate les onglets Ventes/Dépenses
```

### Étape 9 — Test workflow clôture (semaine fictive)

Pour valider que tout marche :
1. Crée quelques ventes manuelles via `/comptabilite`
2. Verse une "paie" fictive via bot (ou attends une vraie clôture)
3. Lundi 00h00 → vérifie qu'un onglet `Semaine N (jj-jj mois aaaa)` est créé
4. Vérifie que `/rh` affiche bien les snapshots

---

## 🧠 7. Décisions architecturales notables

### Pourquoi pas un framework JS (React/Vue/Svelte) ?
Le patron RP n'est pas développeur. Pas de build step, pas de npm install côté client. Tout est éditable en ligne via GitHub web editor si besoin de hotfix. Le coût = un peu de duplication HTML/JS mais c'est tractable (~12k LOC).

### Pourquoi Firebase et pas Supabase/PostgreSQL ?
Auth + DB + Functions + Hosting (initialement) dans un seul écosystème, gratuit jusqu'à un certain volume. Firestore est ultra-rapide en lecture côté client (SDK temps réel) ce qui colle bien avec le dashboard direction.

### Pourquoi un Sheet Google et pas une page admin ?
Le **contrôleur IRS RP** veut voir un Sheet "officiel" partageable comme dans la vraie vie. Le Sheet est généré côté serveur (Dashboard) + IMPORTDATA pour les onglets live. Les onglets snapshot par semaine clôturée sont écrits via Sheets API et figés pour audit.

### Pourquoi un bot Discord et pas un mod FiveM custom ?
Pas accès au code serveur RP. FaabHook (mod tier) remonte déjà tout sur Discord via embeds. On parse ces embeds = zéro intrusion serveur, juste de la lecture.

### Pourquoi snapshots `/paiesEstimees` + onglet Sheet par semaine ?
Avant v1.7.0, si tu supprimais un compte employé après clôture, sa trace disparaissait des KPI. Les snapshots figent les noms + montants au moment de la clôture pour permettre un audit IRS rétroactif fiable (cf. incident "Crook" semaine du 11/05).

### Pourquoi calcul de paie dupliqué backend/frontend ?
Le frontend affiche les estimations en temps réel (semaine en cours, recalcul live). Le backend les fige à la clôture (snapshot). Pas de bundler partagé, donc duplication pragmatique dans `public/js/utils/paie.js` + `firebase/functions/lib/paie-calc.mjs` avec commentaire de rappel.

### Pourquoi `firebase/functions/lib/` est gitignored ?
Historique. Le dossier est aussi celui où TypeScript compile par défaut. On garde les helpers `.mjs` dedans (force-add `git add -f`) pour éviter de réorganiser tout le monorepo.

### Pourquoi pas de tests automatisés ?
Pas de CI/CD initialement. Tests manuels uniquement. À ajouter si évolution future, mais pour un volume RP modéré ça reste maintenu manuellement.

---

## 📊 8. Schéma Firestore (collections principales)

```
/users/{uid}
  prenom, nom, email, role, statut, actif, compteEnFinance,
  idDiscord, idPerso, dateEntree, ...

/ventes/{id}
  timestamp, source ('discord'|'manuelle'|'rattrapage-factures'),
  factureId, vendeurDiscord, vendeurNom, vendeurUserId,
  clientNom, montant, paiement, produits[],
  cachee (true si doublon dedupliqué), annulee, ...

/depenses/{id}
  timestamp, raison, montant, type, deductible,
  fournisseurLabel, valideParPatron, raisonClassification,
  utilisateur, soldeAvant, soldeApres, ...

/paies/{id}
  timestamp, payeurDiscord, payeurNom, beneficiaireDiscord,
  beneficiaireNom, beneficiaireId, montant, periode,
  weekKeyAttribuee (posé à la clôture pour rattacher à la bonne semaine)

/semaines/{weekKey="YYYY-MM-DD"}    # weekKey = date du lundi
  numero, dateDebut, dateFin, ca, beneficeBrut, depenses,
  chargesDeductibles, masseSalariale, beneficeNet,
  nbVentes, nbDepenses, statut ('cloturee-partielle'|'cloturee-manuelle'|'cloturee'),
  cloturePar, cloturParNom, dateClotureManuelle, noteCloture,
  fenetrePaieDebut, fenetrePaieFin

/paiesEstimees/{weekKey}_{userId}    # snapshot Option B (v1.6.0+)
  userId, weekKey, role, prenom, nom, montantEstime,
  ca, caParticulier, bidons, caoutchoucs,
  paye (bool), datePaiement, paieMatcheeId, paieMatcheeMontant,
  majPar, majParNom, dateMaj, createdAt

/banqueLtd/{id}    # mouvements bancaires (entrées xbankaccount + sorties)
  timestamp, type ('add'|'remove'), montant, soldeAvant, soldeApres,
  raison, categorieEntree ('subvention'|null), ...

/redistributions/{id}    # ventes carburant agrégées par station
  timestamp, station, montant, ...

/stations/{id}    # stations-essence
  nom, position, pompes[{essence, stock, prix}], stocksMatieres, ...

/stocks/{produitId}    # stock épicerie
  nom, categorie, prix, stockActuel, seuilAlerte, pourPro, ...

/engagements/{id}    # dettes / subventions à rembourser
  beneficiaire, signataire, objet, type, montantInitial,
  montantRembourse, montantRestant, dateEcheance, statut ('actif'|'rembourse'|'annule')

/alertes/{id}    # alertes anti-vol / stock / fraude
  timestamp, type, severite, message, resolue, lu, ...

/config/global    # singleton — config globale
  fournisseurs[{id, label, matchType, matchValue, categorie, deductible}],
  quotaBidons, quotaCaoutchoucs, prixCarburant, fivemPompesMap, ...
```

---

## 🔐 9. Schéma ACL (rôles + permissions)

Source : `public/js/utils/permissions.js` (côté client) + `firebase/firestore.rules` (côté serveur).

| Rôle | Statut | Pages accessibles | Actions |
|---|---|---|---|
| `patron` | Direction | TOUT | Tout (incl. clôture, admin, suppression compte) |
| `co-patron` | Direction | TOUT | Idem patron sauf retrait du patron |
| `drh` | RH | Dashboard, RH, Banque (lecture), Compta (lecture), Stations, Stocks, Revenus carburant | Gestion users, cocher Versé, lecture compta, **PAS clôture ni admin** |
| `responsable-vente` | Encadrement | Dashboard, RH (lecture), Stations, Stocks, Ventes | Valider ventes, gérer stocks épicerie |
| `responsable-pompiste` | Encadrement | Dashboard, RH (lecture), Stations, Revenus carburant | Gérer pompistes, ravitailler, ajuster prix |
| `vendeur-novice/intermediaire/experimente` | Employé | Espace perso, Ventes (déclarer/voir siennes), Stocks (lecture) | Déclarer ventes manuelles, consulter ses paies |
| `pompiste-novice/intermediaire/experimente` | Employé | Espace perso, Stations (lecture), Revenus carburant (siens) | Ravitailler, déclarer caoutchoucs, corriger stock |
| `admin-technique` | Support | TOUT | Tout (rôle de support technique pendant la passation) |

Tranches grade vendeur/pompiste : barème commission dans `public/js/utils/paie.js`, alignement TTE Art. 4-1.7.

---

## 🏛 10. Conformité TTE Sandy Shores (à connaître absolument)

> Référence intégrale : `public/guide/10-tte-reference.md` et `docs/TTE-complet.txt`.

**LTD = Secteur 2** (Services et biens indispensables — Art. 4-1.9.1 confirmé par l'IRS).

Règles clés implémentées :
- **Plafonds salariaux** : 19 000 $ employés / 20 000 $ gestion-direction par semaine (Art. 4-1.2 à 4-1.4)
- **Masse salariale ≤ 90 % du CA** (Art. 4-1.5) — alerte si dépassement
- **Primes Art. 4-1.10** (hebdomadaires) : tranches CA → 5 000 / 10 000 / 15 000 $
- **Primes Art. 4-1.11** (mensuelles) : tranches bénéfice net → 20k / 40k / 60k $
- **Déductibilité** : seuls avocats, matières premières et entretien véhicules sont déductibles d'office (Art. 4-1.4). Le reste = décision patron + traçabilité (mapping fournisseurs)
- **Déclaration fiscale** mardi 21h max (Art. 4-3.3) — pénalité +10% par 24h de retard
- **Paiement impôts** mercredi 21h max (Art. 4-3.4)
- **Tranches d'imposition** (Art. 4-3.2) : 0 / 10 / 19 / 28 / 36 / 46 %
- **Sanctions IRS** : paliers 1-4 (5/7/10% du compte + pénalités)
- **Cessation paiement** après 4 semaines de déficit consécutives

⚠ **JAMAIS d'auto-classification déductible** : le code propose, le patron décide. Cf. `feedback_tte_decision_patron` (mémoire).

---

## 🐛 11. Pièges connus / surveillance

- **Timezone UTC vs Paris** : Cloud Functions tournent en UTC. Toujours convertir via les helpers `toParisWall` / `parisWallToUtcGlobal` dans `firebase/functions/index.js`. Bug récurrent dans le passé : `dateDebut.toISOString().slice(0,10)` shift au jour précédent en CEST. Préférer un format `${y}-${m}-${d}` local.
- **Firebase secrets** : sur Windows PowerShell, ne JAMAIS faire `echo "x" | firebase secrets:set` (ajoute un `\r\n` parasite). Utiliser `--data-file <fichier_sans_newline>`.
- **firebase/functions/lib/ gitignored** : penser à `git add -f` quand on crée un nouveau module dans `lib/`.
- **Cache IMPORTDATA Sheets** : ~1h. Pour casser : `node scripts/force-refresh-sheet.js` (modifie le param `&_t=` dans la formule).
- **Onglet Sheet supprimé par erreur** : pas de soft-delete Google. Re-créer manuellement ou relancer le script de génération approprié.
- **Bot Discord redémarré** : il rejoue les messages depuis le dernier offset stocké. Risque de doublons si l'offset n'est pas correctement sauvegardé. Vérifier `discord-bot/state.json` ou équivalent.
- **Node 20 deprecation** : décommissionné 2026-10-30 par Google. Penser à passer en Node 22 avant cette date (test compatibility firebase-functions v6+).

---

## 📓 12. Journal & historique

- **`docs/JOURNAL.md`** — journal chronologique session par session. À lire de bas en haut pour comprendre l'évolution des décisions.
- **`docs/ROADMAP.md`** — chantiers en cours, à surveiller, résolus.

**Évolution récente** (pour contextualiser la maturité du squelette) :
- v1.0.0 — squelette de base : login, ventes, dépenses, paies
- v1.3.0 — bot Discord opérationnel, parsing FaabHook
- v1.4.0 — Sheet compta Dashboard généré côté serveur
- v1.5.0 — versioning + signature BLATV
- v1.6.0 — Option B snapshot paies + KPI bénéfice cumulé + sélecteur historique semaine
- **v1.7.0** (courante) — onglet Sheet par semaine clôturée + ID Discord bénéf. dans snapshot

---

## 🤝 13. Pour Claude qui reprend ce projet

Si tu es une nouvelle conversation Claude qui reçoit ce dossier, voici la séquence de travail recommandée :

1. **Lis ce document en entier** (HANDOFF-NOUVEAU-LTD.md)
2. **Lis le `README.md`** pour la vue produit
3. **Lis `docs/JOURNAL.md` en partant du bas** (= les sessions les plus récentes, pour comprendre l'état actuel)
4. **Lis `docs/ROADMAP.md`** pour savoir ce qui reste à faire / à surveiller
5. **Demande au user** :
   - Le nom du nouveau LTD
   - La DA visuelle souhaitée (rester western ? autre thème ?)
   - Le sous-domaine GitHub Pages cible (ou domaine custom)
   - Le serveur Discord cible (canaux logs)
   - S'il a déjà fait la partie comptes externes ou s'il faut l'accompagner
6. **Propose un plan en 3-5 grosses étapes** au lieu de tout faire d'un coup
7. **Pour les modifications de DA** : commence par `western.css` + `logo.png` + `version.js` + `README.md`, puis itère

### Règles d'engagement importantes (héritées de la session source)

- **Autonomie totale** : commit / push / deploy / scripts CLI sans demander le terminal au user. Il valide après coup s'il veut.
- **Pas d'emoji dans le code/commits/docs sauf si le user en met explicitement**. Le code source du projet n'en contient pas (sauf UI markdown).
- **Pas de tests si le user n'en demande pas** — c'est un projet RP solo, pas une codebase prod multi-équipe.
- **Toujours mettre à jour `public/guide/*.md` quand on touche à l'UI** (règle `feedback_maintenir_docs`).
- **JAMAIS d'auto-classification déductibilité** — le patron décide (`feedback_tte_decision_patron`).
- **Terminologie semaines** : utiliser weekKey `YYYY-MM-DD` (du lundi) OU label ISO `S20 2026`. Pas de raccourcis maison type "W18".
- **Salaire vendeur** = `CA × commission` (pas bénéfice). Calibrage aligné sur plafonds 40k → 13/14/15k selon grade.
- **Bénéfice net** = CA − dépenses totales − masse salariale (afficher "CA − dépenses − salaires versés" dans l'UI pour clarté).

### Bibliographie minimale (mémoire de Claude originale)

Les "mémoires" suivantes ont guidé toutes les décisions. Si tu peux les recréer/conserver dans la nouvelle conversation :

- `projet_ltd_sandy_shores` — vue produit
- `references_infrastructure` — URLs Firebase, GitHub, Functions
- `references_tte_*` — règles TTE complètes
- `feedback_maintenir_docs` — UI = MAJ guide dans le même commit
- `feedback_autonomie_execution` — exécuter commit/push/deploy sans demander
- `feedback_tte_decision_patron` — jamais d'auto-classification
- `feedback_nomenclature_semaines` — utiliser weekKey ou S20, pas W18
- `projet_snapshots_paies_option_b` — feature v1.6.0+

---

## ✅ 14. Checklist finale "ready to clone"

Avant de donner ce dossier à une nouvelle convo, vérifier :

- [ ] Le repo source est à jour sur `main` (pull récent)
- [ ] `docs/JOURNAL.md` reflète la dernière session
- [ ] `docs/ROADMAP.md` ne contient pas de "EN COURS" inachevé
- [ ] `public/js/version.js` cohérent avec les derniers commits
- [ ] `firebase/serviceAccountKey.json` PAS commit (vérifier `git status`)
- [ ] `discord-bot/config.json` PAS commit
- [ ] `IDENTIFIANTS-*.txt` PAS commit

---

*Document généré pour le bootstrap d'un nouveau LTD basé sur le squelette LTD Sandy Shores v1.7.0. Bonne reprise ! 🤠*
