# 2 — Setup du bot Discord

> Durée estimée : 25 minutes
> Niveau : moyen (un peu de terminal)

Le bot lit les embeds postés par les bots de logs FiveM dans vos canaux et
relaie les évènements vers Firebase via la Cloud Function `botIngest`.

## Étape 1 : Créer l'application Discord

1. Aller sur [discord.com/developers/applications](https://discord.com/developers/applications)
2. **New Application** → nom : `LTD Sandy Shores Bot`
3. Onglet **Bot** (gauche) :
   - **Reset Token** → **copier le token** (à mettre dans `.env` plus tard)
   - **Privileged Gateway Intents** → activer :
     - ✅ **Message Content Intent**
     - ✅ **Server Members Intent**
4. Sauvegarder

## Étape 2 : Inviter le bot sur votre serveur

1. Onglet **OAuth2** → **URL Generator**
2. Scopes : ✅ `bot`
3. Bot Permissions : ✅ `View Channels`, ✅ `Read Message History`
4. **Copier l'URL générée** en bas, l'ouvrir dans un navigateur, choisir le
   serveur **LTD SandyShores** et autoriser

## Étape 3 : Activer le mode développeur Discord

1. Discord → Paramètres utilisateur → **Avancés** → **Mode développeur** ON
2. Cela permet de copier les IDs (clic-droit → Copier l'ID)

## Étape 4 : Récupérer les IDs des canaux

Pour chaque canal listé ci-dessous : **clic-droit sur le canal → Copier l'ID**

| Canal Discord                | Variable .env                    |
|------------------------------|----------------------------------|
| `logs-ig`                    | `CH_LOGS_IG`                     |
| `logs-services`              | `CH_LOGS_SERVICES`               |
| `suivi-facture`              | `CH_SUIVI_FACTURE`               |
| `suivi-achat-essence`        | `CH_SUIVI_ACHAT_ESSENCE`         |
| `dépenses`                   | `CH_DEPENSES`                    |
| `paie`                       | `CH_PAIE`                        |
| `suivi-coffre`               | `CH_SUIVI_COFFRE`                |
| (facultatifs — logs bruts) ↓ |                                  |
| `suivi-coffre-secondaire`    | `CH_SUIVI_COFFRE_SECONDAIRE`     |
| `alerte-coffre`              | `CH_ALERTE_COFFRE`               |
| `revenu`                     | `CH_REVENU`                      |
| `factures`                   | `CH_FACTURES`                    |
| `statsbank`                  | `CH_STATSBANK`                   |
| `logs-licenciement`          | `CH_LOGS_LICENCIEMENT`           |
| `logs-avertissement`         | `CH_LOGS_AVERTISSEMENT`          |

ID du serveur (Guild) : clic-droit sur le serveur → Copier l'ID → variable `GUILD_ID`.

## Étape 5 : Configurer le bot

```bash
cd discord-bot
cp .env.example .env
```

Ouvrir `.env` et compléter :

```ini
DISCORD_TOKEN=ton_token_du_step_1
GUILD_ID=id_du_serveur

INGEST_URL=https://botingest-xxx.europe-west1.run.app
INGEST_TOKEN=ton_token_aleatoire_du_setup_firebase

CH_LOGS_IG=...
CH_LOGS_SERVICES=...
CH_SUIVI_FACTURE=...
CH_SUIVI_ACHAT_ESSENCE=...
CH_DEPENSES=...
CH_PAIE=...
CH_SUIVI_COFFRE=...
```

## Étape 6 : Lancer le bot

```bash
cd discord-bot
npm install
npm start
```

Sortie attendue :

```
✅ Bot connecté : LTD Sandy Shores Bot#1234
   Canaux surveillés : 7
   Canaux logs bruts : 7
```

## Étape 7 : Tester

Provoquer un évènement (ex : log inventaire IG) et vérifier dans la console
Firebase → Firestore Database → collection `mouvementsStock` qu'une nouvelle
entrée apparaît.

## Hébergement permanent (recommandé)

Le bot doit tourner en continu. Trois options classées par effort :

### Option A — Railway (gratuit, ~5 min)

1. [railway.app](https://railway.app) → connecter GitHub
2. **New project** → **Deploy from GitHub repo**
3. Sélectionner le dépôt → choisir le dossier `discord-bot`
4. Variables d'environnement : copier-coller le contenu de `.env`
5. Deploy

### Option B — VPS Hetzner (~3 €/mois, robuste)

```bash
# Sur le VPS Ubuntu :
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
git clone <votre-repo>
cd <votre-repo>/discord-bot
npm install
cp .env.example .env  # éditer
sudo npm install -g pm2
pm2 start index.js --name ltd-bot
pm2 save
pm2 startup           # suivre l'instruction affichée
```

### Option C — Raspberry Pi à la maison (gratuit, dépend du réseau)

Identique à Option B sur Raspberry Pi OS.

## Dépannage

- **`Used disallowed intents`** → activer Message Content Intent (étape 1)
- **`Missing Access`** → le bot n'a pas la permission de lire le canal
  (vérifier les permissions de rôle Discord)
- **Pas d'événement reçu côté Firebase** → vérifier `INGEST_URL` et
  `INGEST_TOKEN` (les deux doivent matcher le secret côté Firebase)

## Étape suivante

➡ [03-setup-github-pages.md](03-setup-github-pages.md)
