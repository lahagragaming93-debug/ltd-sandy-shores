# 01 — Vision produit & Stack technique

## 🎯 Vision produit

Le squelette LTD Sandy Shores est une **plateforme web complète de gestion** pour un commerce détaillant (LTD = Local du Travail Détaillant) sur le serveur FiveM Sandy Shores RPG. Il gère :

### Métiers couverts

1. **Épicerie multisites** : ventes au comptoir IG, déclarations manuelles vendeurs sur le site pour gagner leur commission
2. **Franchise stations-essence** : 8 stations gérées par des pompistes (ravitaillements, stocks bidons/caoutchoucs, quotas hebdo, scoring)
3. **Comptabilité conforme TTE** : déclaration fiscale hebdomadaire automatisée, plafonds salariaux, primes Art. 4-1.10/4-1.11, classification déductibilité
4. **Audit IRS in-game** : Google Sheet partageable au contrôleur RP avec onglets snapshots figés semaine par semaine

### Public et personae

- **Patron RP** (Blake MARS chez Sandy Shores) — utilise le site pour : valider dépenses, clôturer la semaine, verser les paies (en jeu), exporter la compta. PAS un développeur.
- **Co-patron** (Luciana ANGEL MARS) — mêmes droits que patron sauf retrait du patron.
- **DRH** (Broas NESQUIK) — gère effectif RH + cocher Versé sur les paies, lecture compta. Ne peut pas clôturer ni admin.
- **Responsables** (Vente, Pompiste) — encadrement opérationnel.
- **Vendeurs / Pompistes** — déclarent leurs ventes/services manuellement, consultent leur espace perso.
- **Admin technique** (Andrew BEAUCHAMP) — support technique pendant la passation, droits identiques au patron.
- **Contrôleur IRS RP** — consulte le Sheet partagé en lecture seule (audit fiscal RP).

### Promesses du produit

- **Zéro friction patron** : il clique 🔒 le lundi matin et tout se fige. Pas besoin de comprendre comment ça marche.
- **Audit IRS prêt** : un Sheet officiel, un onglet par semaine, tout figé pour le contrôleur.
- **Bot Discord transparent** : le patron ne configure rien, le bot écoute les logs FaabHook et alimente la base automatiquement.
- **Conformité TTE par construction** : les plafonds, primes, déclarations sont câblés dans le code.

---

## 🏗 Stack technique complète

### Frontend

| Composant | Tech | Pourquoi |
|---|---|---|
| Framework | **HTML/CSS/JS vanilla** + Firebase SDK CDN | Pas de build, le patron peut hotfix en ligne. ~12k LOC tractables. |
| Modules | **ES6 natifs** (`import` / `export`) | Pas de bundler. Compatible navigateurs modernes. |
| Hébergement | **GitHub Pages** | Gratuit, auto-deploy au push sur `main`. |
| Auth client | **Firebase Auth SDK** | Email/password, session persistante locale |
| Données client | **Firebase Firestore SDK** | Queries temps réel (`onSnapshot`) + one-shot (`getDocs`) |
| Markdown | **marked.js** v12 (CDN à la demande) | Rendu du guide intégré |
| CSS | **Vanilla** — `public/css/western.css` (1899 lignes) | Thème saloon/western, palette ivoire/rouge sang/doré |
| Icônes | **Émojis Unicode** | Pas de dépendance externe |
| Pages | **15 fichiers HTML** + 1 par rôle/feature | Voir `04-pages-frontend.md` |

### Backend

| Composant | Tech | Pourquoi |
|---|---|---|
| Runtime | **Node.js 20** (Cloud Functions Gen2) | Compatibilité Firebase Functions actuelle (deprecation 2026-10-30, à upgrade vers Node 22 avant) |
| Région | `europe-west1` | Données RP francophone |
| HTTP | **`onRequest` Firebase Functions** | Endpoints REST simples (POST + Bearer auth) |
| Cron | **`onSchedule` Firebase Functions** | TZ `Europe/Paris`, cron syntax standard |
| DB Admin | **`firebase-admin` SDK** | Lecture/écriture privilégiée Firestore |
| Sheets API | **`googleapis`** v140+ | Service account JSON, scope `spreadsheets` |
| Secrets | **Firebase Secrets Manager** | `COMPTA_TOKEN`, `DASHBOARD_SA_KEY` |
| Fichiers | `firebase/functions/index.js` (4172 lignes) + `lib/*.mjs` (5 modules) + `scripts/*.js` (15 outils CLI) |

### Bot Discord

| Composant | Tech | Pourquoi |
|---|---|---|
| Lib | **`discord.js` v14** | Standard de facto |
| Runtime | **Node.js 18+** | Léger, déployable sur Railway/Fly.io/VPS |
| Persistance | Firebase Admin SDK (mêmes credentials que Functions) |
| Auth | Bot token Discord + service account Firebase |
| Architecture | `index.js` (router) + `parsers/<type>.js` (1 par embed) |

### Google Sheets (doc compta IRS)

| Composant | Tech | Pourquoi |
|---|---|---|
| Création | Manuelle dans Google Drive | 1 Sheet par LTD |
| Service account | Edit access partagé au compte service Firebase | Permet aux Functions d'écrire |
| Onglet `📊 Dashboard` | Généré côté serveur via `lib/dashboard-core.mjs` | Refresh manuel (bouton UI) + cron every-minute keep-alive |
| Onglets `Ventes Semaine N` + `Dépenses Semaine N` (live) | **`=IMPORTDATA(...)`** vers endpoint `comptaExport` | Cache ~1h, cassable via `force-refresh-sheet.js` |
| Onglets `Semaine N (jj-jj mois aaaa)` (snapshots) | Générés côté serveur via `lib/snapshot-sheet-semaine.mjs` à chaque clôture | Figés pour audit IRS, ne changent plus après création |

### Versioning & déploiement

| Composant | Tech | Notes |
|---|---|---|
| Code source | **Git + GitHub** | Branche unique `main`. Pas de PR workflow, commit direct. |
| Version | `public/js/version.js` (constante `VERSION`) | SemVer. Source de vérité unique. Affichée sidebar + footer. |
| Deploy Functions | **`firebase deploy --only functions:...`** | Filtrer par function pour deploy ciblé (gagner du temps) |
| Deploy Hosting frontend | **Push GitHub** | GitHub Pages republie auto en ~1 min |
| Deploy Bot | Manuel sur VPS / Railway / Fly.io | Pas de CI/CD configuré |

---

## 🌐 Comptes externes à provisionner pour un nouveau LTD

### 1. Google Cloud / Firebase

- **Firebase Console** : créer un nouveau projet
  - Project ID : choisir un nom unique (ex: `ltd-mon-nouveau-ltd-XXXX`)
  - Région Firestore : `europe-west1` (cohérent avec Functions)
  - Activer **Firestore** (mode production)
  - Activer **Authentication** → Email/Password
  - Activer **Functions** : nécessite **plan Blaze** (carte CB requise, mais quasi-gratuit pour ce volume)
- **Google Cloud Console** (auto-lié) : générer une **clé service account** JSON pour Sheets API
  - IAM > Service Accounts > Créer (ex: `dashboard-writer@<projet>.iam.gserviceaccount.com`)
  - Activer Google Sheets API
  - Télécharger la clé JSON → à placer dans `firebase/serviceAccountKey.json` (gitignored)

### 2. Google Drive

- Créer un nouveau Google Sheet "Comptabilité LTD [Nom]"
- Partager en édition avec l'email du service account
- Récupérer l'ID du Sheet depuis l'URL : `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`

### 3. Discord Developer Portal

- https://discord.com/developers/applications → New Application
- Créer un Bot, copier le TOKEN
- Inviter le bot sur le serveur RP cible avec scopes :
  - `bot`
  - Permissions : `Read Messages`, `Read Message History` (sur les canaux FaabHook : `#facturation-ig`, `#depenses`, `#paie`, `#logs-ig`)
- Récupérer les IDs des canaux (clic droit → Copier l'identifiant, mode développeur activé)

### 4. GitHub

- Créer un repo public (recommandé pour GitHub Pages gratuit) ou fork du squelette
- Activer **GitHub Pages** : Settings > Pages > Source = `Deploy from branch` > Branch `main` / folder `/ (root)` ou `/docs` selon ta structure
- Wait : ici le repo est servi depuis la racine, l'URL devient `https://<user>.github.io/<repo>/`
- (Optionnel) Domaine custom → CNAME pointant vers `<user>.github.io`

### 5. Local dev environment

- **Node.js 18+** (recommandé 20 pour cohérence Functions)
- **Firebase CLI** : `npm install -g firebase-tools`
- **Git**
- **PowerShell** (Windows) — ⚠ attention au newline parasite lors des `firebase secrets:set` (cf `14-pieges-known-issues.md`)
- (Optionnel) **VS Code** ou autre éditeur

---

## 💰 Coûts opérationnels estimés

| Service | Coût mensuel | Notes |
|---|---|---|
| Firebase Spark (gratuit) | 0 $ | Insuffisant — Functions Gen2 require Blaze |
| Firebase Blaze | ~0-5 $ | Quasi-gratuit pour volume RP. Firestore : 50k reads/jour gratuit. Functions : 2M invocations/mois gratuit. |
| Google Sheets API | 0 $ | Quota largement suffisant |
| Discord Bot | 0 $ | Hébergement séparé (cf ligne suivante) |
| Hébergement bot Discord (VPS / Railway / Fly.io) | 0-5 $ | Fly.io free tier OK pour bot léger |
| GitHub Pages | 0 $ | Public repo gratuit |
| Domaine custom (optionnel) | ~10 $/an | Ex: namecheap, ovh |
| **TOTAL** | **~0-10 $/mois** | Pour un usage RP normal |

---

## 🔗 Points d'intégration externes (à surveiller)

- **FaabHook embeds** : si le mod RP change son format de log, les parsers du bot doivent être ajustés (cf `07-discord-bot.md`)
- **TTE règles** : si l'IRS RP modifie un article, mettre à jour `public/guide/10-tte-reference.md` + le code de calcul des primes / déductibilité
- **Pompes carburant FiveM** : le mapping `/config/global.fivemPompesMap` correspond aux IDs des pompes du serveur RP. À ré-init si serveur change.
- **xbankaccount** : les entrées bancaires du LTD sont remontées via cet ID de compte FiveM. À adapter dans la config selon le compte du nouveau LTD.

---

## 🎨 Identité visuelle (DA) actuelle

- **Style** : Saloon / Western / Ouest américain
- **Palette** :
  - Rouge sang `#8B0000` (titres, alertes)
  - Ivoire `#F5F0E8` (fond, texte)
  - Doré `#c9a961` (accents, badges)
  - Vert `#4a7c2e` (succès, CA)
  - Bleu `#4a6b8a` (info, bénéfice)
  - Orange `#c97f1a` (warnings)
- **Typo** : Georgia (titres serif) + sans-serif système (corps)
- **Iconographie** : Émojis Unicode (🤠, 💰, 📊, ⛽…)
- **Tonalité** : Direct, peu de blabla, micro-copy efficace

→ Pour adapter à un autre univers RP (mafia, futuriste, cyberpunk, etc.) : refonte `western.css` + remplacement logo/favicon + ajustement de quelques émojis et termes RP. Voir `12-personnalisation-da.md`.
