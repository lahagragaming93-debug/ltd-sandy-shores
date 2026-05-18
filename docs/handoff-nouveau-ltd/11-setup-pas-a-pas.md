# 11 — Setup pas-à-pas : bootstrap un nouveau LTD

> Checklist exécutable de A à Z. Compter **6-10h** de travail pour le premier déploiement. Possible d'étaler sur 2 jours.

---

## ✅ Pré-requis

- [ ] Carte bancaire (Firebase Blaze plan = paiement à l'usage, ~0$/mois pour ce volume)
- [ ] Compte Google (pour Firebase + Google Sheet)
- [ ] Compte Discord (admin du serveur RP cible, pour inviter le bot)
- [ ] Compte GitHub
- [ ] Node.js 18+ installé localement (recommandé 20)
- [ ] Firebase CLI (`npm install -g firebase-tools`)
- [ ] Git
- [ ] Un éditeur de code (VS Code recommandé)
- [ ] Le nom du nouveau LTD et la DA visuelle souhaitée

---

## 📅 PHASE 1 — Provisionner les comptes externes (1-2h)

### 1.1 Firebase project

- [ ] Aller sur https://console.firebase.google.com → **Add project**
- [ ] Nom : ex `ltd-mon-nouveau-ltd` (project ID auto-suffixé `-XXXX`)
- [ ] **Désactiver Google Analytics** (pas utile)
- [ ] Sélectionner région : **`europe-west1`** (cohérent avec les Functions)

### 1.2 Activer les services Firebase

Dans le projet Firebase :
- [ ] **Authentication** → Get Started → activer **Email/Password**
- [ ] **Firestore Database** → Create database → mode **Production** → région **europe-west1**
- [ ] **Functions** → activer (besoin du **plan Blaze** : Upgrade → carte CB)

### 1.3 Service account pour Sheets API

- [ ] Aller sur https://console.cloud.google.com → ton projet
- [ ] APIs & Services → Library → activer **Google Sheets API**
- [ ] IAM & Admin → Service Accounts → **Create**
  - Nom : `dashboard-writer`
  - Pas de rôles IAM nécessaires (juste l'identité)
- [ ] Sur le service account créé → onglet "Keys" → **Add Key** → JSON
- [ ] Télécharger le fichier JSON (= ta clé service account)
- [ ] **Renommer en `serviceAccountKey.json`** et le placer dans `firebase/` (qui est gitignored)

### 1.4 Google Sheet "Comptabilité"

- [ ] Créer un nouveau Google Sheet dans Drive : "Comptabilité LTD [Nom]"
- [ ] Partager en **édition** avec l'email du service account (visible dans le JSON, ex `dashboard-writer@<projet>.iam.gserviceaccount.com`)
- [ ] Récupérer le `SHEET_ID` depuis l'URL : `https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit`
- [ ] Noter le `SHEET_ID` pour plus tard

### 1.5 Discord Bot

- [ ] Aller sur https://discord.com/developers/applications → **New Application**
- [ ] Donner un nom (ex: "LTD [Nom] Bot")
- [ ] Onglet **Bot** → **Add Bot** → confirmer
- [ ] **Reset Token** → copier et garder précieusement (ne s'affichera plus)
- [ ] Onglet **OAuth2** → URL Generator :
  - Scopes : `bot`
  - Permissions : `Read Messages/View Channels` + `Read Message History`
- [ ] Copier l'URL générée, l'ouvrir dans le navigateur, choisir le serveur RP cible, autoriser
- [ ] Sur le serveur Discord cible : **activer Mode développeur** (Paramètres utilisateur → Avancés)
- [ ] Récupérer les IDs des canaux pertinents (clic droit canal → Copier l'identifiant) :
  - `#facturation-ig`
  - `#depenses`
  - `#paie`
  - `#logs-ig`
  - + tous les canaux FaabHook utilisés

### 1.6 GitHub repo

- [ ] Créer un nouveau repo **public** (ou fork du squelette Sandy Shores)
- [ ] Settings → Pages → Source `Deploy from branch` → branche `main` → folder `/ (root)`
- [ ] Noter l'URL GitHub Pages : `https://<user>.github.io/<repo>/`

---

## 🔧 PHASE 2 — Cloner et configurer le code (1-2h)

### 2.1 Cloner le repo

```bash
git clone https://github.com/<toi>/ltd-nouveau.git
cd ltd-nouveau

# Vérifier qu'on a bien tout
ls public/ firebase/ discord-bot/ docs/
```

### 2.2 Installer les dépendances

```bash
# Cloud Functions
cd firebase/functions
npm install
cd ../..

# Bot Discord
cd discord-bot
npm install
cd ..
```

### 2.3 Login Firebase CLI

```bash
firebase login
firebase use --add  # choisir le nouveau projet, donner alias 'default'
```

### 2.4 Personnaliser la config Firebase frontend

**Fichier `public/js/firebase-config.js`** (à éditer manuellement, copier-coller depuis Firebase Console → ⚙ Project Settings → Web app → Config) :

```js
export const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXX",
  authDomain: "ltd-mon-nouveau-ltd-XXXX.firebaseapp.com",
  projectId: "ltd-mon-nouveau-ltd-XXXX",
  storageBucket: "ltd-mon-nouveau-ltd-XXXX.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};
```

### 2.5 Remplacer le SHEET_ID partout

```bash
# Identifier les occurrences
grep -rn "1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY" firebase/ public/

# Remplacer dans :
# - firebase/functions/index.js → const SHEET_ID_COMPTA = '<NOUVEAU>'
# - firebase/functions/lib/dashboard-core.mjs → const SHEET_ID = '<NOUVEAU>'
# - firebase/functions/lib/snapshot-sheet-semaine.mjs → const SHEET_ID = '<NOUVEAU>'
# - firebase/functions/lib/refresh-importdata.mjs → const SHEET_ID = '<NOUVEAU>'
```

### 2.6 Remplacer le projectId Firebase partout

```bash
# Identifier
grep -rn "ltd-sandy-shores-f3919" firebase/ public/ discord-bot/

# Remplacer dans :
# - firebase/.firebaserc (auto via firebase use)
# - public/js/api.js → URL marquerPaieVersee Function
# - public/js/firebase-config.js (déjà fait étape 2.4)
# - Commentaires URLs dans index.js
```

### 2.7 Personnaliser le branding

Voir `12-personnalisation-da.md` pour le détail. Minimum :
- [ ] `public/js/version.js` → `VERSION = '1.0.0'`, `AUTHOR = 'TonNom'`
- [ ] `public/img/logo.png` → ton logo
- [ ] `public/img/favicon.png` → ton favicon
- [ ] `public/index.html` + tous les `.html` → `<title>` à jour
- [ ] `public/js/layout.js` → nom LTD dans sidebar
- [ ] `README.md` → présentation projet
- [ ] Tous les "Sandy Shores" / "SANDY SHORES" → nouveau nom (utiliser `grep -rn`)

---

## ⚙ PHASE 3 — Setup secrets et déployer le backend (30 min)

### 3.1 Placer la clé service account

- [ ] Mettre `serviceAccountKey.json` dans `firebase/` (déjà gitignored)

### 3.2 Définir les secrets Firebase

```bash
cd firebase/functions

# Secret pour authentifier comptaExport (utilisé dans les formules IMPORTDATA)
# Générer une chaîne random de 32 chars (ex avec openssl)
openssl rand -hex 32
# Coller la valeur quand prompté
firebase functions:secrets:set COMPTA_TOKEN

# Secret pour Sheets API (contenu du JSON service account)
firebase functions:secrets:set DASHBOARD_SA_KEY --data-file ../serviceAccountKey.json

# (Optionnel) Secret pour authentifier le bot Discord côté botIngest
firebase functions:secrets:set BOT_INGEST_SECRET
```

⚠ **Windows PowerShell** : NE PAS faire `echo "x" | firebase secrets:set` (ajoute \r\n parasite). Toujours utiliser `--data-file <fichier_sans_newline>`.

### 3.3 Déployer Cloud Functions + Firestore rules

```bash
firebase deploy --only "functions,firestore:rules"
```

Compter 5-10 min. Si erreur :
- Vérifier que le plan Blaze est bien activé
- Vérifier que les APIs sont bien activées (Cloud Build, Cloud Functions, Artifact Registry, Cloud Run)
- Vérifier la région : `europe-west1`

### 3.4 Tester un endpoint

```bash
# Tester comptaExport (ventes)
curl "https://europe-west1-<projet>.cloudfunctions.net/comptaExport?type=ventes&token=<COMPTA_TOKEN>"
# Doit retourner du CSV (header + lignes si données déjà présentes, ou juste header si DB vide)
```

---

## 🌱 PHASE 4 — Bootstrap données initiales (30 min)

### 4.1 Adapter les scripts init à ton LTD

Avant de lancer, **éditer** chaque script selon les spécificités RP :

- `firebase/functions/scripts/init-stations.js` :
  - Ajuster la liste des stations (8 chez Sandy Shores, peut-être plus/moins)
  - Coords FiveM, noms, pompes par station

- `firebase/functions/scripts/init-stocks.js` :
  - Catalogue produits initial (cola, bonbons, etc.)
  - Si tu hérites du catalogue Sandy Shores, garde tel quel et ajuste après

- `firebase/functions/scripts/init-fournisseurs-mapping.js` :
  - Patterns de matching des fournisseurs RP du nouveau LTD
  - Ex : Yootool boutique 263, Fournisseur LTD boutique 215, etc.

- `firebase/functions/scripts/init-engagements.js` :
  - À éditer/skip selon si le nouveau LTD a une subvention de démarrage

### 4.2 Lancer les scripts

```bash
cd firebase/functions

node scripts/init-stations.js
node scripts/init-stocks.js
node scripts/init-fournisseurs-mapping.js
# (Optionnel) node scripts/init-engagements.js
```

Vérifier dans Firebase Console → Firestore que les collections `/stations`, `/stocks`, `/config/global` sont peuplées.

---

## 👤 PHASE 5 — Premier compte patron (15 min)

### 5.1 Pusher le repo sur GitHub

```bash
git add -A
git commit -m "Initial setup LTD [Nom]"
git push origin main
```

→ GitHub Pages republie automatiquement dans ~1 min.

### 5.2 Ouvrir le site et créer le compte

- [ ] Aller sur `https://<user>.github.io/<repo>/`
- [ ] Voir le formulaire "Créer un compte patron" (visible car DB users vide)
- [ ] Email + password → crée le compte
- [ ] Le code crée auto le user avec `role: 'patron'`, `actif: true`, `compteEnFinance: true`

### 5.3 Compléter ton profil manuellement

Aller dans **Firebase Console → Firestore → /users/{ton uid}** et éditer :
- `prenom: 'Ton'`, `nom: 'NOM'`
- `idDiscord: 'ton ID Discord'`
- `idPerso: 'ton matricule RP'`
- `dateEntree: '2026-MM-JJ'`

Ou via `/admin` une fois connecté (UI dédiée).

### 5.4 Test login + dashboard

- [ ] Logout / login avec ton compte
- [ ] Vérifier que tu accèdes à `/dashboard` (vide mais sans erreur)
- [ ] Vérifier la sidebar (toutes les sections direction visibles)

---

## 🤖 PHASE 6 — Setup bot Discord (1h)

### 6.1 Créer la config

```bash
cd discord-bot

# Créer config.json
cat > config.json <<'EOF'
{
  "discordToken": "<TOKEN_BOT>",
  "guildId": "<ID_SERVEUR_DISCORD>",
  "channels": {
    "facturationIg": "<ID_CANAL_#facturation-ig>",
    "depenses": "<ID_CANAL_#depenses>",
    "paie": "<ID_CANAL_#paie>",
    "logsIg": "<ID_CANAL_#logs-ig>"
  },
  "botIngestUrl": "https://europe-west1-<projet>.cloudfunctions.net/botIngest",
  "botIngestSecret": "<même valeur que BOT_INGEST_SECRET>"
}
EOF
```

### 6.2 Tester en local

```bash
node index.js
```

Le bot doit se connecter (`Logged in as ...`). Faire une vente IG sur le serveur RP → vérifier que le bot voit l'embed et le traite.

### 6.3 Déployer en production

**Option A — VPS personnel** :
- Push `discord-bot/` sur le VPS
- `pm2 start index.js --name ltd-bot`
- `pm2 startup` puis `pm2 save` pour daemon

**Option B — Railway (gratuit)** :
- railway.app → New Project → Deploy from GitHub
- Variables d'env : `DISCORD_TOKEN`, `GUILD_ID`, `BOT_INGEST_URL`, `BOT_INGEST_SECRET`, `CHANNEL_FACTURATION_IG`, etc.
- Auto-deploy au push

**Option C — Fly.io** :
- `fly launch` dans `discord-bot/`
- Setup `fly.toml` minimal
- `fly secrets set DISCORD_TOKEN=...`

---

## 📊 PHASE 7 — Setup Sheet compta (30 min)

### 7.1 Premier refresh Dashboard

```bash
cd firebase/functions
node scripts/refaire-dashboard-pro.js
```

→ Doit créer l'onglet `📊 Dashboard` dans le Sheet avec le bandeau "LTD [Nom]" + KPI vides.

⚠ Si erreur "permission denied" : vérifier que le service account a bien edit sur le Sheet (étape 1.4).

### 7.2 Créer les onglets live Ventes / Dépenses

**Manuellement** dans Google Sheets :
- Créer 2 nouveaux onglets : `Ventes` et `Dépenses`
- En cellule A1 de chacun, coller :
  ```
  =IMPORTDATA("https://europe-west1-<projet>.cloudfunctions.net/comptaExport?type=ventes&token=<COMPTA_TOKEN>&_t=1")
  ```
  (et `type=depenses` pour le 2e)
- Sheet charge automatiquement les données (header uniquement si DB vide)

### 7.3 Appliquer le formatage

```bash
cd firebase/functions
node scripts/format-sheet.js
```

→ Applique header rouge, bordures, money format, datetime, zebra ivoire/blanc sur les onglets Ventes/Dépenses.

### 7.4 Tester la clôture (semaine fictive)

Si tu veux valider que tout marche **avant la première vraie semaine** :
- Crée quelques ventes manuelles via `/comptabilite` (saisir des montants fakes)
- Crée quelques dépenses
- Attendre lundi 00h00 OU déclencher manuellement la clôture via `/comptabilite` 🔒
- Vérifier qu'un onglet `Semaine N (jj-jj mois aaaa)` est créé dans le Sheet
- Vérifier que `/rh` affiche bien les snapshots paies

---

## 🧪 PHASE 8 — Tests E2E (1h)

Checklist de validation avant ouverture aux employés :

- [ ] **Login** patron + dashboard accessible
- [ ] **Créer un employé** via `/admin` → login avec son compte → voit `/employee` mais pas `/admin`
- [ ] **Bot Discord** : faire une vente IG → vérifier qu'elle apparaît sur `/ventes`
- [ ] **Bot Discord** : faire une dépense IG → vérifier qu'elle apparaît sur `/comptabilite` avec badge classification
- [ ] **Sheet** : F5 sur le Sheet → Dashboard à jour, onglets Ventes/Dépenses à jour
- [ ] **Clôture test** : déclencher manuellement le bouton 🔒 → onglet `Semaine N` créé, snapshots `/paiesEstimees` créés
- [ ] **Cocher Versé** sur `/rh` → vérifier que le bouton fonctionne, KPI "Reste à verser" descend
- [ ] **Refresh Dashboard** depuis le site → bouton `🔄` fonctionne

---

## 🚀 PHASE 9 — Mise en service (15 min)

- [ ] Inviter les employés à créer leur compte (envoyer le lien `https://<user>.github.io/<repo>/`)
- [ ] Pour chaque employé : aller dans `/admin` → définir son rôle, statut, compteEnFinance
- [ ] Partager le Sheet au contrôleur IRS en **lecture seule**
- [ ] Annoncer sur le serveur RP : "Le LTD [Nom] est ouvert"
- [ ] Premier lundi : tester la clôture en conditions réelles

---

## 📅 PHASE 10 — Maintenance continue

### Hebdomadaire
- Surveiller la conformité TTE sur le Dashboard (masse salariale ≤ 90 % CA)
- Vérifier que la clôture cron s'exécute bien lundi 00h
- Backfill manuel si trou dans les données (vente oubliée, etc.)

### Mensuelle
- `node scripts/backup-complet.js` pour sauvegarder Firestore
- Revue des engagements de remboursement actifs (échéances proches)

### Sur incident
- Logs Firebase Functions : `firebase functions:log --only <function>`
- Logs bot Discord : selon hébergement (Railway, VPS, etc.)
- Rollback déploiement Functions si besoin : `firebase functions:rollback` (note : pas natif, faire `git revert` + redeploy)

---

## 🆘 Aide

- En cas de bug → `14-pieges-known-issues.md`
- Pour modifier les règles TTE → `10-tte-rules.md`
- Pour changer la DA visuelle → `12-personnalisation-da.md`
- Pour les scripts CLI dispos → `13-scripts-cli.md`
- Tu es Claude qui aide → `16-pour-claude-suivant.md`
