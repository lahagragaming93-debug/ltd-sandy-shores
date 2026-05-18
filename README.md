# LTD Sandy Shores — Plateforme de gestion

> **Version `1.7.0`** — by **BLATV**

Plateforme web complète de gestion pour le LTD Sandy Shores (épicerie multisites + franchise stations-essence) opérant sur le serveur FiveM Sandy Shores RPG. Conforme TTE Chapitre IV — Secteur 2.

> Toutes les valeurs financières sont en **dollars RP** ($).

## Architecture

| Couche               | Technologie                                  |
|----------------------|----------------------------------------------|
| Frontend             | HTML / CSS / JS Vanilla (Firebase SDK CDN)   |
| Hébergement frontend | GitHub Pages                                 |
| Auth                 | Firebase Authentication                      |
| Base de données      | Firebase Firestore                           |
| Backend              | Firebase Functions (Node.js 20)              |
| Bot                  | Bot Discord Node.js (`discord.js` v14)       |
| Doc compta IRS       | Google Sheets via Sheets API (service account) |

## Arborescence

```
LTD Sandy Shores/
├── public/                  Frontend statique (GitHub Pages)
│   ├── index.html           Login / inscription patron
│   ├── *.html               15 pages applicatives (dashboard, comptabilite, rh, ventes, ...)
│   ├── css/western.css      Thème saloon/western
│   ├── img/                 Logo + favicon
│   ├── js/                  Modules JS (pages, auth, api, utils, layout, version)
│   └── guide/               11 guides markdown (1 par rôle + faq + tte)
├── firebase/
│   ├── firebase.json
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   └── functions/
│       ├── index.js         4172 lignes — Cloud Functions (cron + HTTP)
│       ├── lib/             5 modules (dashboard-core, snapshot, paie-calc, ...)
│       └── scripts/         15 outils CLI (init-*, list-*, format-sheet, ...)
├── discord-bot/             Bot Discord (parse FaabHook → Firestore)
└── docs/                    Documentation
    ├── JOURNAL.md           Journal chronologique session par session
    ├── ROADMAP.md           Chantiers en cours / résolus / à surveiller
    ├── TTE-complet.txt      Référence TTE intégrale (12 chapitres)
    ├── 07-transmission.md   Passation au vrai patron RP
    └── handoff-nouveau-ltd/ Bootstrap d'un nouveau LTD (20 fichiers, 7300 LOC)
```

## Démarrage

### 📖 Utilisation quotidienne par rôle

Le guide complet est **intégré au site** : `📖 Guide` dans la sidebar de n'importe quelle page. Le bon guide se sélectionne automatiquement selon ton rôle.

Sources des guides (lisibles aussi sur GitHub) :

| Rôle | Guide |
|------|------------|
| Patron / Co-Patron | [`public/guide/01-direction.md`](public/guide/01-direction.md) |
| DRH | [`public/guide/02-drh.md`](public/guide/02-drh.md) |
| Responsable Vente | [`public/guide/03-responsable-vente.md`](public/guide/03-responsable-vente.md) |
| Responsable Pompiste | [`public/guide/04-responsable-pompiste.md`](public/guide/04-responsable-pompiste.md) |
| Vendeur | [`public/guide/05-vendeur.md`](public/guide/05-vendeur.md) |
| Pompiste | [`public/guide/06-pompiste.md`](public/guide/06-pompiste.md) |
| Automatismes (technique) | [`public/guide/07-automatismes.md`](public/guide/07-automatismes.md) |
| FAQ + dépannage | [`public/guide/08-faq-depannage.md`](public/guide/08-faq-depannage.md) |
| 🔐 Comptabilité (direction / DRH / admin) | [`public/guide/09-comptabilite.md`](public/guide/09-comptabilite.md) |
| 🔐 Référence TTE (direction / DRH / admin) | [`public/guide/10-tte-reference.md`](public/guide/10-tte-reference.md) |

### 🚀 Cloner ce squelette pour un nouveau LTD

Tout est documenté dans le dossier **[`docs/handoff-nouveau-ltd/`](docs/handoff-nouveau-ltd/)** (20 fichiers, ~7300 LOC). Self-contained : une nouvelle conv Claude peut reprendre le projet sans contexte de la conv source.

Commencer par lire :
1. [`00-INDEX.md`](docs/handoff-nouveau-ltd/00-INDEX.md) — sommaire + plan de lecture
2. [`11-setup-pas-a-pas.md`](docs/handoff-nouveau-ltd/11-setup-pas-a-pas.md) — bootstrap nouveau LTD en 10 phases (6-10h)
3. [`16-pour-claude-suivant.md`](docs/handoff-nouveau-ltd/16-pour-claude-suivant.md) — règles d'engagement pour Claude

### 📓 Reprise de session

- [`docs/JOURNAL.md`](docs/JOURNAL.md) — état des lieux session par session
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — TODO + chantiers en cours
- [`docs/07-transmission.md`](docs/07-transmission.md) — passation au vrai patron RP

## Conformité TTE

L'application implémente les règles du **TTE Chapitre IV — Secteur 2** :
- Plafonds salariaux (19 000 $ employés, 20 000 $ direction)
- Masse salariale ≤ 90 % du CA (Art. 4-1.5)
- Primes hebdomadaires Art. 4-1.10 + mensuelles Art. 4-1.11
- Clôture hebdomadaire automatique le lundi 00 h 00 + manuelle 🔒
- Snapshots paies + onglet Sheet par semaine clôturée (audit IRS)
- Tranches d'imposition Art. 4-3.2 (0/10/19/28/36/46 %)

Référence intégrale dans [`docs/TTE-complet.txt`](docs/TTE-complet.txt) ou via le guide intégré.

## Versioning

Source unique : [`public/js/version.js`](public/js/version.js). Affichée sidebar + footer. Convention **SemVer** (`MAJOR.MINOR.PATCH`).

---

*Plateforme développée et maintenue par **BLATV**.*
