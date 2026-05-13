# 6 — Architecture technique (référence)

## Flux des données

```
   ┌──────────────────────┐
   │  Serveur Discord     │
   │  LTD SandyShores     │
   │  (canaux de logs)    │
   └─────────┬────────────┘
             │  Embeds postés par les bots FiveM
             ▼
   ┌──────────────────────┐
   │  Bot Discord         │
   │  (Node.js, hebergé   │
   │   sur Railway/VPS)   │
   └─────────┬────────────┘
             │  HTTPS POST + token partagé
             ▼
   ┌──────────────────────┐
   │  Cloud Function      │
   │   `botIngest`        │
   │  (Firebase)          │
   └─────────┬────────────┘
             │  Admin SDK
             ▼
   ┌──────────────────────┐         ┌──────────────────────────────────┐
   │  Firestore           │ <─────> │  Cloud Functions                 │
   │  (collections)       │         │  Ingestion :                     │
   │                      │         │  - botIngest                     │
   │                      │         │  Cron :                          │
   │                      │         │  - clotureHebdo (lun 00h)        │
   │                      │         │  - clotureHebdoPaies (mar 21:05) │
   │                      │         │  - verifierSortiesExpirees (5min)│
   │                      │         │  Callables (auth) :              │
   │                      │         │  - declarerVente / modifierVente │
   │                      │         │  - pompisteRavitaillerManuel     │
   │                      │         │  - pompisteDeclarerCaoutchoucs   │
   │                      │         │  - adminResetPassword            │
   │                      │         │  - migrateUsername               │
   │                      │         │  Triggers Firestore :            │
   │                      │         │  - alerteStock / alerteStation   │
   │                      │         │  - alerteVenteSansStock          │
   │                      │         │  - onAvertissementChange         │
   │                      │         │  - onMouvementStockCreated       │
   │                      │         │  HTTP public (token) :           │
   │                      │         │  - comptaExport (Sheets)         │
   └─────────┬────────────┘         └──────────────────────────────────┘
             │  SDK Web v10 modular
             ▼
   ┌──────────────────────┐
   │  Frontend            │
   │  (HTML/CSS/JS)       │
   │  GitHub Pages        │
   └──────────────────────┘
```

## Collections Firestore

| Collection           | Clé doc           | Description                              |
|----------------------|-------------------|------------------------------------------|
| `users`              | uid Firebase Auth | Profil + rôle + ID Discord/Perso         |
| `produits`           | slug              | Catalogue (prix vente + achat + seuil)   |
| `stocks`             | slug              | Quantité courante + dernière maj         |
| `mouvementsStock`    | auto              | Historique entrées/sorties               |
| `ventes`             | auto              | 1 doc par facture, items, bénéfice       |
| `stations`           | slug              | 8 stations essence + niveau              |
| `redistributions`    | auto              | Historique redistributions               |
| `services`           | auto              | 1 doc par session terminée               |
| `servicesOuverts`    | uid               | Sessions en cours (clé = employeId)      |
| `quotasPompiste`     | weekId_employeId  | Cumul bidons + caoutchoucs par semaine   |
| `depenses`           | auto              | Charges déductibles ou non               |
| `paies`              | auto              | Paiements employés (logs Discord)        |
| `semaines`           | YYYY-MM-DD lundi  | Snapshots hebdo clôturés (6 max)         |
| `alertes`            | auto              | Alertes générées par triggers Functions  |
| `config`             | `global`          | Quotas, prix essence, seuils             |
| `coffres`            | coffreId          | Snapshots panel coffre                   |
| `logsBruts`          | auto              | Logs des canaux non-structurés           |
| `historiquePrix`     | auto              | Historique des changements de prix produits |
| `rhEvenements`       | auto              | Embauches, exclusions, avertissements, licenciements |
| `dossiersEmployes`   | threadId Discord  | Fiches RH structurées (téléphone, IBAN, pôle) |
| `rapportsPompisteQuotidien` | auto       | Snapshot quotidien CA + niveaux stations |
| `statsHebdoOfficiels` | weekId           | Récap hebdo FiveM officiel (#statsbank)  |
| `banqueLtd`          | auto              | Mouvements bancaires LTD                 |
| `avertissements`     | auto              | Avertissements RH (3 actifs = compte bloqué) |
| `declarationsCaoutchouc` | auto          | Audit déclaration manuelle caoutchoucs pompiste |
| `sorties_en_cours`   | auto              | Anti-vol 30min : sortie coffre LTD en attente de régularisation |
| `counters`           | nom              | Compteurs séquentiels (ex. factures manuelles `M{date}-{seq}`) |

## Parsers Discord (bot)

Chaque parser lit les embeds d'un canal Discord, normalise et POST vers `botIngest`.

| Canal Discord | Parser | Type payload |
|---------------|--------|--------------|
| `#logs-ig` | `inventory.js` (filtre source LTD + mapping FiveM) | `inventory` |
| `#logs-ig` | `xbankaccount.js` | `bankAccount` |
| `#logs-services` | `service.js` | `service` |
| `#suivi-facture` | `facture.js` | `facture` |
| `#suivi-achat-essence` | `essence.js` | `redistribution` |
| `#depenses` | `depense.js` | `depense` |
| `#paie` | `paie.js` | `paie` |
| `#suivi-coffre` | `coffre.js` | `coffre` |
| `#auto-rh` | `autoRh.js` | `autoRh` |
| `#autorankup` | `autorankup.js` | `autorankup` |
| `#statsbank` | `statsbank.js` | `statsbank` |
| `#pompiste` | `rapportPompiste.js` | `rapportPompiste` |
| `#⛽ Station` (dashboard) | `stationsDashboard.js` (listenEdits, fetchOnStartup) | `stationsDashboard` |
| `#ventes` | `venteAuto.js` | `venteAuto` |
| `#📋 Dossiers-Employers` (forum threads) | `dossierEmploye.js` (route via parentId, listenEdits) | `dossierEmploye` |
| `#logs-avertissement` (bot Jéssica) | `avertissement.js` | `avertissement` |
| `#logs-licenciement` (bot Jéssica) | `licenciement.js` | `licenciement` |

## Sécurité

- **Frontend** : règles Firestore strictes par rôle (`firestore.rules`)
- **Bot** : utilise un token partagé `LTD_BOT_INGEST_TOKEN` (secret Firebase)
- **Cloud Functions** : Admin SDK donc bypass des rules (pas de risque
  d'élévation depuis le frontend)
- **GitHub Pages** : domaine ajouté dans Authorized domains Firebase

## Performances

- Firebase Spark (gratuit) suffisant tant que < 50 000 reads/jour
  (largement au-dessus de l'usage typique d'un LTD)
- Plan Blaze nécessaire pour Cloud Functions seulement, mais reste gratuit
  dans les quotas (Cloud Functions = ~5 € de crédit/mois inclus)

## Points d'extension

Si vous voulez aller plus loin :

- **Mobile** : ajouter un manifeste PWA (`public/manifest.json`)
- **Notifications push** : Firebase Cloud Messaging
- **Logo** : remplacer le placeholder dans `public/css/western.css` (sélecteur `.logo-placeholder`)
- **Multi-LTD** : ajouter un champ `entrepriseId` dans toutes les collections
