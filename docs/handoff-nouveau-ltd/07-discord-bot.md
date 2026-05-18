# 07 — Bot Discord (FaabHook parser)

> Architecture, parsers, format des embeds, configuration. Le bot écoute les canaux logs RP et alimente Firestore.

---

## 🎯 Rôle du bot

Sur le serveur FiveM Sandy Shores, le mod **FaabHook** envoie automatiquement des **embeds Discord** sur des canaux dédiés à chaque action IG (vente, paiement, ravitaillement, etc.). Le bot LTD :

1. **Écoute** ces canaux (event `messageCreate` de discord.js v14)
2. **Parse** les embeds selon leur structure (titre, fields, footer)
3. **Mappe** les données en docs Firestore (via endpoint `botIngest` Cloud Function)
4. **Déduplique** si déjà reçu (basé sur factureId / timestamp / etc.)
5. **Auto-classifie** les dépenses via mapping `/config/global.fournisseurs`

Le bot n'écrit **JAMAIS** directement en Firestore — tout passe par `botIngest` pour la validation côté serveur.

---

## 🏗 Architecture

```
discord-bot/
├── index.js                  Router principal — listener messageCreate + dispatch
├── package.json              discord.js v14, axios, dotenv
├── config.json               GITIGNORED — token + canal IDs + ingestUrl
├── .env                      GITIGNORED — alternatif
└── parsers/
    ├── facture.js            #facturation-ig → /ventes
    ├── depense.js            #depenses → /depenses
    ├── paie.js               #paie → /paies
    ├── ravitaillement.js     #logs-ig (essence) → /stations/{id}/ravitaillements
    ├── banque.js             #logs-ig (banque) → /banqueLtd
    ├── facture-annulee.js    annulation facture IG → marque vente cachee=true
    └── ... (autres selon évolution)
```

---

## ⚙ Configuration `config.json`

```json
{
  "discordToken": "<TOKEN_BOT_DISCORD>",
  "guildId": "<ID_SERVEUR_DISCORD>",
  "channels": {
    "facturationIg": "<ID_CANAL_#facturation-ig>",
    "depenses": "<ID_CANAL_#depenses>",
    "paie": "<ID_CANAL_#paie>",
    "logsIg": "<ID_CANAL_#logs-ig>"
  },
  "botIngestUrl": "https://europe-west1-<projet>.cloudfunctions.net/botIngest",
  "botIngestSecret": "<CLE_PARTAGEE_AVEC_FUNCTION>"
}
```

⚠ **Sécurité** : la clé `botIngestSecret` est partagée entre le bot et la Cloud Function pour authentifier les requêtes. À configurer côté Functions via `firebase functions:secrets:set BOT_INGEST_SECRET`.

---

## 📋 Format des embeds FaabHook

Format général d'un embed Discord :
```js
{
  title: '🧾 Facture #1923212',
  color: 0x2ECC71,
  fields: [
    { name: 'Vendeur', value: 'Jeorge STEVENSON (123-456)', inline: true },
    { name: 'Client', value: 'Yuri Lacerda (789-012)', inline: true },
    { name: 'Montant', value: '208 $', inline: true },
    { name: 'Articles', value: 'cola x12, bonbon x20', inline: false }
  ],
  footer: { text: 'Sandy Shores Gaz · 17/05/2026 23:22:31' },
  timestamp: '2026-05-17T22:22:31Z'
}
```

### Pièges connus

- **Préfixe `name:` dans value** : certains embeds collent le nom du field dans la value (parse à nettoyer)
- **Owner ≠ source** : pour les paies, le `owner` Discord (`<@id>`) n'est pas toujours le `source` (qui a déclenché)
- **Items en snake_case interne** : `cola_zero`, `bonbon_x20` → mapping à faire avec `/stocks/{produitId}.fivemItemId`
- **IDs Discord 15-21 chiffres** : toujours stocker en `string`, jamais `Number` (perte précision)

---

## 🔍 Parsers — un par type d'embed

### `parsers/facture.js` — Ventes IG

**Canal écouté** : `#facturation-ig` (FaabHook quand un vendeur encaisse)

**Données extraites** :
- `factureId` (numéro IG : `1923212`)
- `vendeurDiscord`, `vendeurNom`, `vendeurIdPerso`
- `clientNom`, `clientIdPerso`
- `montant` (parsé depuis "208 $")
- `produits[]` (parsé depuis "cola x12, bonbon x20" + mapping `/stocks`)
- `paiement` ("especes" si embed dit "espèces", sinon "carte")
- `station` (depuis footer)

**Création** : `POST /botIngest { type: 'vente', data: {...} }`

**Dédup** : `factureId` unique. Si déjà reçu → skip (sauf si modif).

---

### `parsers/depense.js` — Dépenses

**Canal écouté** : `#depenses` (FaabHook xbankaccount removemoney)

**Données extraites** :
- `montant`
- `raison` (free text, ex "Achat boutique N°264")
- `compteCible` (si embed le précise)
- `utilisateur` (qui a déclenché côté serveur)
- `soldeAvant`, `soldeApres`

**Auto-classification** :
- Lit `/config/global.fournisseurs`
- Pour chaque pattern, teste matchType (`boutique`, `compte-cible`, `raison-contient`) avec matchValue
- Si match → `fournisseurLabel`, `categorie`, `deductible` suggérés (mais `valideParPatron: false`)

**Création** : `POST /botIngest { type: 'depense', data: {...} }`

---

### `parsers/paie.js` — Paies versées

**Canal écouté** : `#paie` (FaabHook quand patron utilise la commande IG)

**Données extraites** :
- `payeurDiscord`, `payeurNom`
- `beneficiaireDiscord`, `beneficiaireNom`
- `montant`
- `timestamp` (embed timestamp)

**⚠ Piège** : les noms remontés sont souvent au format `Blake Mars (<@999...>)` — il faut nettoyer avec `cleanNomBot()` côté Cloud Function pour avoir un `Prénom NOM` propre dans l'UI.

**Création** : `POST /botIngest { type: 'paie', data: {...} }`

**Tag semaine** : à la création, `weekKeyAttribuee` n'est PAS posé. Il est ajouté à la clôture (cron étape 1 ou bouton 🔒). Cela permet de rattacher logiquement la paie à la bonne semaine.

---

### `parsers/ravitaillement.js` — Ravitaillement station

**Canal écouté** : `#logs-ig` (FaabHook quand pompiste ravitaille via commande IG)

**Données extraites** :
- `pompiste` (qui a ravitaillé)
- `station`, `pompeIdx`
- `quantite` (bidons utilisés)

**Création** : `POST /botIngest { type: 'ravitaillement', data: {...} }`

---

### `parsers/banque.js` — Mouvements bancaires (xbankaccount)

**Canal écouté** : `#logs-ig` (FaabHook entrées/sorties compte LTD)

**Données extraites** :
- `type: 'add' | 'remove'`
- `montant`
- `soldeAvant`, `soldeApres`
- `raison`

**Création** : `POST /botIngest { type: 'banque', data: {...} }`

---

### `parsers/facture-annulee.js` — Annulation de facture IG (F1 menu)

**Canal écouté** : `#facturation-ig` (embed couleur rouge)

**Action** : marque la vente correspondante `annulee: true` dans `/ventes`.

---

## 🔧 Catalogue items (mapping FiveM → produit site)

Pour parser correctement "cola x12" il faut savoir que :
- `cola` (FiveM item ID) = `cola` (slug Firestore)
- `cola_zero` = `cola-zero`
- `bonbon_x20` = `bonbon-x20`

Le mapping est dans `/stocks/{produitId}.fivemItemId` (+ `alias[]` pour les variantes).

Pour générer rapidement la liste à jour pour le parser :
```bash
cd firebase/functions
node scripts/list-produits-pour-parser.js > ../../discord-bot/parsers/items-catalogue.json
```

---

## 🚨 Items non mappés (découverte)

Si un parser reçoit un item inconnu, il :
- Logue le nom de l'item
- Crée une alerte `/alertes` type `item-non-mappe`
- L'item apparaît sur `/decouverte-items.html` (page tech)

Le patron / admin-tech peut alors :
- Ajouter le mapping via `/admin` → Catalogue produits
- Re-déclencher le parsing si nécessaire

---

## 🔄 Reprise après crash bot

Le bot ne stocke pas d'offset par défaut. Au redémarrage, il ignore les messages historiques (event `messageCreate` ne se déclenche que pour les nouveaux).

**Pour rattraper un trou** :
- Soit déclarer manuellement les ventes manquantes via site
- Soit utiliser un script ad-hoc qui scrape l'historique Discord (`messages.fetch({ before: ..., limit: 100 })`) et envoie chaque embed au handler

⚠ Risque de doublons si on lance plusieurs fois — d'où la dédup côté Cloud Function par factureId.

---

## 🚀 Déploiement bot

Le bot est un process Node.js permanent. Options :

### Option 1 — Local (dev)
```bash
cd discord-bot
node index.js
# ou avec pm2 pour daemon
pm2 start index.js --name ltd-bot
```

### Option 2 — VPS (production simple)
- Pull le repo sur le VPS
- `npm install`
- `node index.js` dans tmux/screen, ou `pm2`

### Option 3 — Railway / Fly.io (gratuit, serverless)
- Déployer le dossier `discord-bot/` comme service Node.js
- Variables d'env : `DISCORD_TOKEN`, `GUILD_ID`, `CHANNEL_*`, `BOT_INGEST_URL`, `BOT_INGEST_SECRET`
- Free tier suffisant pour un bot léger

### Option 4 — Cloud Run (Firebase ecosystem)
- Containeriser le bot, déployer sur Cloud Run
- Plus complexe mais cohérent avec la stack Firebase

---

## 📊 Logs & monitoring

Le bot logue dans `console.log` :
- Chaque message reçu : `[parser-X] embed reçu, traitement...`
- Chaque ingest réussi : `[parser-X] ingest OK pour <ref>`
- Chaque erreur : `[parser-X] ERROR : ...`

Pour debug en prod, surveiller les logs via :
- Railway / Fly.io : interface web
- VPS : `pm2 logs ltd-bot` ou `tail -f /var/log/...`

---

## 🔐 Permissions Discord nécessaires

Lors de l'invitation du bot sur le serveur RP, cocher :
- ✅ Read Messages / View Channels (sur les canaux logs)
- ✅ Read Message History
- ❌ Send Messages (pas besoin, bot purement listener)
- ❌ Manage Messages

Scope : `bot` (suffit, pas besoin de `applications.commands` car pas de slash commands).
