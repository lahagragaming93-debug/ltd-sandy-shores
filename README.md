# LTD Sandy Shores — Plateforme de gestion

Plateforme web complète de gestion pour le LTD Sandy Shores (épicerie multisites + franchise stations-essence) opérant sur le serveur FiveM Sandy Shores.

> Toutes les valeurs financières sont en **dollars RP** ($).

## Architecture

| Couche               | Technologie                                  |
|----------------------|----------------------------------------------|
| Frontend             | HTML / CSS / JS Vanilla (Firebase SDK CDN)   |
| Hébergement frontend | GitHub Pages                                 |
| Auth                 | Firebase Authentication                      |
| Base de données      | Firebase Firestore                           |
| Backend              | Firebase Functions (Node.js)                 |
| Bot                  | Bot Discord Node.js (`discord.js`)           |

## Arborescence

```
LTD Sandy Shores/
├── public/                  Frontend statique (GitHub Pages)
│   ├── index.html           Login / inscription patron
│   ├── *.html               Pages applicatives
│   ├── css/                 Thème western
│   ├── js/                  Modules JS (auth, modules, utils)
│   └── assets/
├── firebase/
│   ├── firebase.json
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── functions/           Cloud Functions (clôture hebdo + traitement)
├── discord-bot/             Bot Discord (parse les logs → Firestore)
└── docs/                    Guides setup et utilisation
```

## Démarrage rapide

1. Lire `docs/01-setup-firebase.md` — créer le projet Firebase
2. Lire `docs/02-setup-discord-bot.md` — créer et déployer le bot
3. Lire `docs/03-setup-github-pages.md` — déployer le frontend
4. Lire `docs/04-premier-compte.md` — créer le premier compte patron
5. Lire `docs/05-guide-utilisation.md` — utilisation quotidienne

## Conformité TTE

L'application implémente les règles du TTE Chapitre IV — Secteur 2 :
- Plafonds salariaux (19 000 $ employés, 20 000 $ direction)
- Masse salariale ≤ 90 % du CA
- Primes hebdomadaires (Art. 4-1.10) et mensuelles (Art. 4-1.11)
- Clôture hebdomadaire automatique le dimanche 00 h 00
- Conservation des données ≥ 6 semaines
