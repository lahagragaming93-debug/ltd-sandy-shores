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
   ┌──────────────────────┐         ┌──────────────────────┐
   │  Firestore           │ <─────> │  Cloud Functions     │
   │  (collections)       │         │  - clotureHebdo      │
   │                      │         │  - alerteStock       │
   │                      │         │  - alerteStation     │
   │                      │         │  - alerteVenteSansStock│
   └─────────┬────────────┘         └──────────────────────┘
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
