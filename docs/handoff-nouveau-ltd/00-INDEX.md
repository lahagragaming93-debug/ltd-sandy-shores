# 📦 HANDOFF — Nouveau LTD à partir du squelette Sandy Shores

> **Lis ce fichier en premier.** Tu es Claude dans une nouvelle conversation et tu reçois ce dossier pour bootstrap un nouveau LTD basé sur l'architecture du LTD Sandy Shores. Ce dossier est self-contained — tu n'as pas besoin du contexte de la conversation source.

**Repo source de référence** : LTD Sandy Shores (FiveM RP — Sandy Shores RPG, conforme TTE Chapitre IV Secteur 2).
**Version courante du squelette** : `1.7.0` (snapshot 2026-05-18).
**Auteur original** : BLATV.

---

## 🗂 Sommaire du dossier

| # | Fichier | Quand le lire |
|---|---------|---------------|
| 00 | [`00-INDEX.md`](00-INDEX.md) | **Maintenant.** Vue d'ensemble + plan de lecture |
| 01 | [`01-vision-et-stack.md`](01-vision-et-stack.md) | À quoi sert le produit + stack technique + comptes externes à provisionner |
| 02 | [`02-arborescence.md`](02-arborescence.md) | Structure complète du repo, fichier par fichier |
| 03 | [`03-features.md`](03-features.md) | Inventaire des features fonctionnelles (UI + backend + bot + sheet) |
| 04 | [`04-pages-frontend.md`](04-pages-frontend.md) | Détail page par page (sections, KPI, rôles, actions) |
| 05 | [`05-cloud-functions.md`](05-cloud-functions.md) | Détail endpoint par endpoint (HTTP + cron) |
| 06 | [`06-firestore-schema.md`](06-firestore-schema.md) | Collections Firestore + champs + indexes |
| 07 | [`07-discord-bot.md`](07-discord-bot.md) | Architecture bot + parsers + format embeds FaabHook |
| 08 | [`08-google-sheets.md`](08-google-sheets.md) | Dashboard + onglets snapshot + IMPORTDATA + Sheets API |
| 09 | [`09-permissions-acl.md`](09-permissions-acl.md) | Matrice rôles × pages × actions |
| 10 | [`10-tte-rules.md`](10-tte-rules.md) | Règles TTE Sandy Shores implémentées |
| 11 | [`11-setup-pas-a-pas.md`](11-setup-pas-a-pas.md) | **Bootstrap nouveau LTD — checklist exécutable** |
| 12 | [`12-personnalisation-da.md`](12-personnalisation-da.md) | Quoi modifier pour rebrand visuel (DA) |
| 13 | [`13-scripts-cli.md`](13-scripts-cli.md) | Inventaire des 15 scripts CLI restants + usage |
| 14 | [`14-pieges-known-issues.md`](14-pieges-known-issues.md) | Bugs récurrents, timezone, secrets Windows, etc. |
| 15 | [`15-glossaire-rp.md`](15-glossaire-rp.md) | Termes RP + acronymes + jargon TTE |
| 16 | [`16-pour-claude-suivant.md`](16-pour-claude-suivant.md) | **Instructions opératoires pour toi (Claude)** |
| 📜 | [`TTE-complet.txt`](TTE-complet.txt) | **Référence TTE brute intégrale** (12 chapitres, 1066 lignes) — loi fiscale Sandy Shores RPG. À consulter pour les détails exacts d'un article. |
| 📜 | [`TTE-reference-consolidee.md`](TTE-reference-consolidee.md) | Référence TTE consolidée + formatée (793 lignes) — version "lisible" déployée sur le site sous `/guide?guide=10-tte-reference`. Trous identifiés : chap II-IV/VI et 7-14.2. |

> 📁 `_ARCHIVE-handoff-v1-monobloc.md` est la première version monobloc, gardée pour référence rapide.

⚠ **Pour adapter le squelette à un autre serveur RP** (pas Sandy Shores) : remplacer `TTE-complet.txt` par le doc du serveur cible, et adapter en conséquence `10-tte-rules.md` + le code (cf section "Si tu adaptes à un autre serveur RP" dans `10-tte-rules.md`).

---

## 🎯 Mission en 3 lignes

Tu vas aider le user à **cloner ce projet** vers un nouveau LTD avec :
- **Le même squelette technique** (Firebase + GitHub Pages + Discord bot + Google Sheets)
- **Les mêmes mécaniques métier** (clôture hebdo, paies, snapshots, conformité TTE)
- **Une DA visuelle différente** (logo, palette, naming, à définir avec le user)
- **Sa propre infra** (nouveau projet Firebase, nouveau Sheet, nouveau bot Discord, nouveau repo GitHub)

---

## 📋 Plan de lecture recommandé (ordre)

**Pour comprendre rapidement le projet (30 min)** :
1. `01-vision-et-stack.md` — produit + tech
2. `03-features.md` — qu'est-ce qui marche aujourd'hui
3. `11-setup-pas-a-pas.md` — comment bootstrap
4. `16-pour-claude-suivant.md` — règles d'engagement

**Pour creuser un sujet précis** (en cas de besoin) :
- Tu touches le frontend → `04-pages-frontend.md` + `12-personnalisation-da.md`
- Tu touches le backend → `05-cloud-functions.md` + `06-firestore-schema.md`
- Tu touches le bot → `07-discord-bot.md`
- Tu touches le Sheet → `08-google-sheets.md`
- Tu adaptes les règles métier → `10-tte-rules.md`
- Tu débugges un problème → `14-pieges-known-issues.md`
- Tu cherches un terme RP → `15-glossaire-rp.md`

---

## ⏰ Estimation de l'effort

| Phase | Durée estimée | Délivrable |
|---|---|---|
| 1. Comptes externes (Firebase, Discord, GitHub, Google Sheet) | 1-2h | Tout provisionné, clés en main |
| 2. Clone + personnalisation config (SHEET_ID, projectId, etc.) | 1h | Repo prêt à déployer |
| 3. Refonte DA visuelle (logo, palette, naming) | 2-4h | Selon ambition graphique |
| 4. Deploy Functions + Firestore rules | 30 min | Backend opérationnel |
| 5. Bootstrap données initiales (stations, stocks, fournisseurs) | 30 min | Catalogue de base prêt |
| 6. Premier compte patron + test E2E | 1h | Login + dashboard fonctionnel |
| 7. Connexion bot Discord + test parse | 1h | Bot live, ventes/dépenses qui remontent |
| 8. Configuration Sheet (premier refresh Dashboard + format) | 30 min | Sheet partageable au contrôleur |
| **TOTAL** | **6-10h** | Nouveau LTD prêt à servir RP |

---

## 🚦 Première action à proposer au user

Quand le user te dit "ok on commence", propose :

> "On va commencer par 4 questions pour cadrer le projet :
> 1. Quel est le **nom du nouveau LTD** ?
> 2. Veux-tu garder la **DA western** (palette saloon ivoire/rouge/doré) ou refonte complète (préciser : moderne, mafia, futuriste, etc.) ?
> 3. As-tu déjà créé le **projet Firebase** + **Google Sheet** + **bot Discord** + **repo GitHub** ? Ou il faut que je t'accompagne pour cette étape ?
> 4. Le LTD est sur **le même serveur RP Sandy Shores** (donc mêmes règles TTE, mêmes formats FaabHook) ? Ou un autre serveur ?"

Une fois les réponses, génère un plan en 5-7 étapes et propose au user. **Ne fonce pas tête baissée**, valide chaque grande étape avec lui.

---

*Bonne reprise. Tu peux te lancer.*
