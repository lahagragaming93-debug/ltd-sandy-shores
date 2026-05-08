# Bot Discord — LTD Sandy Shores

Ce bot lit les embeds postés sur les canaux de logs de votre serveur
Discord LTD SandyShores et les relaie vers Firebase via la Cloud Function
`botIngest`.

## Installation

```bash
cd discord-bot
npm install
cp .env.example .env
# Renseigner toutes les variables dans .env
npm start
```

Voir `docs/02-setup-discord-bot.md` à la racine du projet pour le guide complet.

## Architecture

```
discord-bot/
├── index.js              Connexion Discord + dispatch par canal
├── parsers/
│   ├── _helpers.js       Helpers communs aux parsers
│   ├── inventory.js      logs-ig (inventory-add / -remove)
│   ├── service.js        logs-services
│   ├── facture.js        suivi-facture
│   ├── essence.js        suivi-achat-essence
│   ├── depense.js        dépenses
│   ├── paie.js           paie
│   └── coffre.js         suivi-coffre
├── package.json
└── .env.example
```

## Hébergement recommandé

- **Local** : tourne sur votre PC tant qu'il est allumé
- **Raspberry Pi** : faible coût, idéal en 24/7
- **VPS** (OVH, Hetzner ~3 €/mois) : recommandé pour la production
- **Railway / Fly.io** : déploiement gratuit avec quota suffisant

Le bot se reconnecte automatiquement en cas de coupure réseau.
