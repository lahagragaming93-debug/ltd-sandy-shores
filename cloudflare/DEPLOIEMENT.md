# LTD Sandy Shores — déploiement Cloudflare Workers

**Adresse du Worker : https://ltd-sandy-api.bla-corporate.workers.dev**
Worker `ltd-sandy-api`, compte Cloudflare du cabinet (même compte que `bla-corporate-api`).
Déployé le 22/08/2026 — le compte de facturation Google étant fermé, les Cloud
Functions du projet `ltd-sandy-shores-f3919` sont mortes depuis le 22/08 02h40.
Firestore et Firebase Auth, eux, répondent toujours : le Worker s'y branche par
l'API REST via la couche de compatibilité.

## Architecture

Même montage que le Worker BLA (`BLA-Corporate/cloudflare/`), qui est le modèle :

- **le code métier n'a pas bougé d'une virgule** : `firebase/functions/index.js`
  (~6 000 lignes, ESM, CRLF), `lib/*.mjs` et `parsers/*.js` sont importés tels
  quels. Le jour où la facturation Google redémarre, ce dossier se jette et le
  code repart sur Cloud Functions sans réconciliation.
- **le shim est RÉFÉRENCÉ PAR CHEMIN RELATIF** vers
  `BLA-Corporate/cloudflare/shim/` (pas copié) : une seule source de vérité,
  les correctifs profitent aux deux Workers. Choix délibéré — les deux dossiers
  vivent sous `BLA-Corporate/`, le chemin est stable.
- deux compléments **locaux** dans `shim-local/`, pour ne pas toucher au shim
  partagé validé en production côté BLA :
  - `firebase-functions-firestore.js` — `onDocumentCreated` / `onDocumentWritten`
    (le dépôt LTD les importe, le shim partagé ne les fournissait pas) ;
  - `firebase-admin-auth.js` — ajoute l'export nommé `getAuth`
    (`import { getAuth } from 'firebase-admin/auth'`, forme utilisée par LTD).

## Ce qui tourne

### Fonctions HTTP (24), sur `/<nom>` ou `/api/<nom>` (camelCase ou kebab-case)

`botIngest` (ingestion des journaux — **verrou anti-répétition `relaisVus`
vérifié en réel** : rejeu du même `_meta.messageId` → `{ok:true, doublon:true}`,
et le verrou est bien rendu quand le traitement échoue), `comptaExport` (CSV du
classeur cabinet — token en query), `logSite`, `migrateUsername`,
`adminResetPassword`, `supprimerEmploye`, `pompisteRavitaillerManuel`,
`pompisteCorrigerStock`, `pompisteDeclarerCaoutchoucs`,
`vendeurDeclarerFabrication`, `creerNoteFrais`, `traiterNoteFrais`,
`modifierRavitaillement`, `supprimerRavitaillement`,
`modifierDeclarationCaoutchoucs`, `supprimerDeclarationCaoutchoucs`,
`declarerVente`, `modifierVente`, `categoriserVente`, `reclasserDepense`,
`refreshDashboardNow`, `gererEngagement`, `cloturerSemaine`, `marquerPaieVersee`.

NB `comptaExport?type=resume` répond 400 « Type inconnu » : ce n'est pas le
Worker, c'est le code métier — `resume` est retiré depuis la v1.7.0. Types
servis : `depenses | ventes | banque | carburant | paies |
masse-salariale-estimee | semaines-fermees`.

### Tâches planifiées (7)

**UNE seule expression cron (`* * * * *`) — et ce n'est pas un choix.** Le plan
Workers Free plafonne à **5 expressions cron par COMPTE** (erreur 10072, mesurée
au premier déploiement), et le Worker BLA en consomme déjà 4. Le répartiteur de
`src/index.js` reproduit donc les sept horaires `onSchedule` du dépôt, en heure
de Paris, à la minute près, sur l'heure PRÉVUE du tic (`event.scheduledTime`) :

| Tâche | Horaire du dépôt (Paris) | Règle du répartiteur |
|---|---|---|
| `relaisDiscord` | every 1 minutes | chaque tic, SAUF si une tâche calendaire est due (le budget de 50 sous-requêtes lui revient ; les curseurs rattrapent au tic suivant) |
| `verifierSortiesExpirees` | */5 | minute % 5 == 2 (déphasée : jamais le tic d'une calendaire ; fenêtre glissante « > 30 min », la phase est indifférente) |
| `dashboardKeepAlive` | every 10 minutes | minute % 10 == 4 (idem) |
| `clotureHebdo` | lundi 00h00 | tic lundi 00h00 Paris, lancée seule |
| `clotureHebdoPaies` | mardi 21h05 | tic mardi 21h05 Paris, lancée seule |
| `archiveAncienMouvementsBanque` | dimanche 03h00 | tic dimanche 03h00 Paris, lancée seule |
| `cronAlertesEngagements` | tous les jours 09h00 | tic 09h00 Paris, lancée seule |

Déclenchement manuel d'une tâche : `GET /__cron/<nom>` avec l'en-tête
`X-Cron-Token` (secret `CRON_TOKEN`, même valeur que sur le Worker BLA).

### Le relais Discord est en MODE ESSAI, et il doit y rester

`ENVOI_ACTIF = false` dans `lib/discord-relay.mjs` : le relais lit les salons,
analyse, consigne dans `relaisEssai` ce qu'il AURAIT envoyé — il n'écrit RIEN
dans la comptabilité. **La bascule à `true` est une décision du patron**, pas
une opération technique. Le jour de la bascule, deux choses à faire ENSEMBLE :

1. vérifier que plus rien d'autre n'ingère (le bot Railway est arrêté) ;
2. changer `INGEST_URL` dans `lib/discord-relay.mjs` — il pointe encore sur
   l'ancienne adresse Cloud Functions (`botingest-tzkzzt4ckq-ew.a.run.app`,
   morte). La bonne adresse est
   `https://ltd-sandy-api.bla-corporate.workers.dev/botIngest`.
   Tant que `ENVOI_ACTIF` est à false, cette adresse n'est jamais appelée.

## Ce qui est écarté

**Les six déclencheurs Firestore ne tournent PLUS.** Un Worker ne peut pas
écouter les écritures Firestore (l'API REST ne diffuse pas). Ils se chargent
(le module en a besoin pour s'évaluer) mais ne se déclenchent jamais :

| Fonction | Ce qui ne se fait plus |
|---|---|
| `alerteStock` | alerte de seuil quand un stock passe sous le minimum |
| `alerteStation` | alerte de niveau de cuve station |
| `alerteVenteSansStock` | alerte « vente sans sortie de stock corrélée » |
| `notifyDeclarationDiscord` | post Discord du JSON IRS à la clôture d'une semaine |
| `onAvertissementChange` | recomptage automatique des avertissements d'un employé |
| `onMouvementStockCreated` | traitement automatique des mouvements coffre |

Aucune fonction puppeteer/googleapis à écarter côté HTTP : le dépôt LTD
n'importe pas puppeteer, et sa seule utilisation de `googleapis` (Sheets v4 :
`spreadsheets.get`, `batchUpdate`, `values.get`, `values.update`) est couverte
par le shim `googleapis.js` — accès au classeur vérifié en réel avec la clé de
service LTD (HTTP 200, « Comptabilité LDT Sandy Shores », 16 onglets).

## Secrets posés (`wrangler secret put`, relevés dans le code)

Copie de sauvegarde : `C:/Users/antho/.bla-ops/secrets-cf-ltd.json`.

| Secret | Valeur | Rôle |
|---|---|---|
| `SERVICE_ACCOUNT_JSON` | clé de service `ltd-sandy-shores-f3919` | Firestore + Auth + jeton Sheets (shim) |
| `DASHBOARD_SA_KEY` | même clé | `JSON.parse` dans `getSheetsClient` ; les scripts locaux du dépôt utilisent déjà cette clé pour le classeur |
| `LTD_BOT_INGEST_TOKEN` | `INGEST_TOKEN` de `C:/tmp/rw-ltd/vars.json` | jeton `x-bot-token` de `botIngest` (aussi lu par le relais) |
| `LTD_COMPTA_EXPORT_TOKEN` | jeton fourni par le cabinet (= `LTD_COMPTA_TOKEN` du Worker BLA) | `comptaExport?token=` |
| `LTD_DISCORD_BOT_TOKEN` | `DISCORD_TOKEN` de `C:/tmp/rw-ltd/vars.json` | sondage des salons par `relaisDiscord` |
| `LTD_LOG_WEBHOOKS` | carte JSON 17 salons → webhooks (serveur BLA, webhooks `relais-*` existants réutilisés, aucun créé) | relai des logs IG (`botIngest`) + logs site (`logSite`) |
| `BLA_LTD_JSON_WEBHOOK` | webhook « BLA Corporate » du salon client Ltd-SandyShore | consommé par `notifyDeclarationDiscord` — INERTE sur Worker (déclencheur Firestore) ; posé par avance |
| `CRON_TOKEN` | même valeur que le Worker BLA | route `/__cron/<nom>` |

Clés de `LTD_LOG_WEBHOOKS` (relevées dans le code — `IG_LOG_CHANNEL` +
`SITE_LOG_CHANNELS`) : `ventes-employe`, `retributions`, `depenses`, `banque`,
`coffre`, `paies`, `stocks-inventaire`, `rh`, `services-vehicules`,
`connexions`, `comptes-acces`, `stocks`, `ventes`, `livraisons`, `notes-frais`,
`compta`, `config`.

## Vérifications faites au déploiement (22/08/2026)

- `wrangler deploy --dry-run` : construction propre (478 KiB, shim REST, zéro gRPC) ;
- `GET /` → `{"ok":true,"service":"ltd-sandy-api","fonctions":24,"planifiees":7,"declencheursFirestoreInertes":6}` ;
- `POST /botIngest` sans jeton → 401 ; mauvais jeton → 401 ;
- `POST /botIngest` type `service` (id d'essai) → `{"ok":true}` ; rejeu même
  `messageId` → `{"ok":true,"doublon":true}` ; embed relayé dans le bon salon
  Discord. Écritures d'essai TOUTES nettoyées (`servicesOuverts`, `relaisVus`,
  message Discord) ;
- NB : un id `__essai_worker__` est refusé par Firestore (« reserved ») — même
  comportement qu'en Cloud Functions ; l'échec a prouvé que le verrou est rendu
  (rejeu retraité, pas « doublon ») ;
- `GET /comptaExport?type=semaines-fermees&token=…` → CSV réel (S33 en tête) ;
  `type=ventes` et `type=paies&semaine=2026-W33` → CSV réels ;
- `relaisDiscord` déclenché via `/__cron/` puis par le cron automatique →
  `relaisEssai/_rapport` frais, 21 salons, 0 erreur, `envoiActif=false`,
  curseurs à jour ;
- accès Sheets (clé LTD) → HTTP 200 sur le classeur compta.

## Ce qui reste

- **Le front** (site LTD, GitHub Pages) appelle encore les adresses Cloud
  Functions mortes (`*.cloudfunctions.net` / `*.run.app`). À basculer vers
  `https://ltd-sandy-api.bla-corporate.workers.dev/<nom>` — suivre la routine
  MAJ du dépôt (bump version + changelog + annonce Discord).
- **La bascule `ENVOI_ACTIF`** (décision du patron) + `INGEST_URL`, voir plus haut.
- **Les six déclencheurs Firestore** restent inertes tant que le code vit sur
  Worker ; si une alerte devient indispensable, il faudra un sondage périodique
  (décision produit, pas prise ici).
- Surveiller la **clôture de lundi 00h00 Paris** (`clotureHebdo`) : première
  exécution réelle sur Worker, budget de 50 sous-requêtes par invocation. En cas
  d'échec : `GET /__cron/clotureHebdo` (X-Cron-Token) pour rejouer, ou la
  fonction HTTP `cloturerSemaine` (clôture manuelle, auth direction).
