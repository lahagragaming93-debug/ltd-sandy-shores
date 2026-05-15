# LTD Sandy Shores — Plateforme de gestion

> **Version `1.5.0`** — by **BLATV**

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

### Setup technique (premier déploiement)
1. Lire `docs/01-setup-firebase.md` — créer le projet Firebase
2. Lire `docs/02-setup-discord-bot.md` — créer et déployer le bot
3. Lire `docs/03-setup-github-pages.md` — déployer le frontend
4. Lire `docs/04-premier-compte.md` — créer le premier compte patron
5. Lire `docs/06-architecture.md` — schéma de flux et collections Firestore

### Utilisation quotidienne (par rôle)

👉 **Le guide complet est intégré au site** : sur n'importe quelle page, onglet **« 📖 Guide »** dans la sidebar. Le bon guide se sélectionne automatiquement selon le rôle de l'utilisateur connecté.

Sources des guides : **`public/guide/`** (servies par GitHub Pages, lisibles aussi sur GitHub).

| Rôle | Doc à lire |
|------|------------|
| Patron / Co-Patron | `public/guide/01-direction.md` |
| DRH | `public/guide/02-drh.md` |
| Responsable Vente | `public/guide/03-responsable-vente.md` |
| Responsable Pompiste | `public/guide/04-responsable-pompiste.md` |
| Vendeur | `public/guide/05-vendeur.md` |
| Pompiste | `public/guide/06-pompiste.md` |
| Tout le monde | `public/guide/07-automatismes.md` + `public/guide/08-faq-depannage.md` |

### Reprise de session
- `docs/JOURNAL.md` — état des lieux, TODO, procédure de reprise
- `docs/07-transmission.md` — passation au vrai patron RP

## Conformité TTE

L'application implémente les règles du TTE Chapitre IV — Secteur 2 :
- Plafonds salariaux (19 000 $ employés, 20 000 $ direction)
- Masse salariale ≤ 90 % du CA
- Primes hebdomadaires (Art. 4-1.10) et mensuelles (Art. 4-1.11)
- Clôture hebdomadaire automatique le dimanche 00 h 00
- Conservation des données ≥ 6 semaines

## Versioning

La version courante est définie dans `public/js/version.js` (source unique de vérité), affichée dans la sidebar du site et dans le footer. Convention **SemVer** (`MAJOR.MINOR.PATCH`).

---

*Plateforme développée et maintenue par **BLATV**.*
