# 📖 Journal de bord — LTD Sandy Shores

> Document de reprise pour les prochaines sessions de travail.
> Dernière mise à jour : **2026-05-09**

---

## 🎯 Vue d'ensemble

Plateforme web de gestion pour le LTD Sandy Shores (épicerie multisites + 8 stations-essence sur serveur FiveM RP). Conforme TTE Chap. IV — Secteur 2.

| Composant | URL / Référence |
|-----------|-----------------|
| 🌐 **Application live** | https://lahagragaming93-debug.github.io/ltd-sandy-shores/ |
| 📦 **Code source** | https://github.com/lahagragaming93-debug/ltd-sandy-shores |
| 🔥 **Console Firebase** | https://console.firebase.google.com/project/ltd-sandy-shores-f3919 |
| 🚂 **Bot Railway** | https://railway.com (compte `lahagragaming93-debug`) |
| 🤖 **Bot Discord** | LTD Sandy Shores Bot#0243 (serveur LTD SandyShores) |

---

## ✅ Ce qui a été fait (session 2026-05-08 → 2026-05-09)

### 1. Création de la plateforme (de zéro)
- Architecture : Vanilla JS + Firebase + Cloud Functions + bot Discord
- 4800 lignes de code, 53 fichiers
- Thème western (rouge sang / beige sable / noir / blanc cassé)
- 8 modules métier : Dashboard, Stocks épicerie, Stations essence, Ventes, Comptabilité, RH, Admin, Mon espace, Mes paies

### 2. Setup Firebase complet
- Projet `ltd-sandy-shores-f3919` créé
- Authentication Email/Password activée
- Firestore Database (région eur3) avec règles strictes par rôle
- 5 indexes composites déployés
- Plan Blaze (pay-as-you-go, 0 € attendu)
- Budget alerte recommandé (5 €/mois)

### 3. Cloud Functions déployées (5)
- `botIngest` (HTTP) — endpoint webhook pour le bot Discord
- `clotureHebdo` — cron lundi 00h00 Europe/Paris
- `alerteStock`, `alerteStation`, `alerteVenteSansStock` — triggers Firestore
- Secret `LTD_BOT_INGEST_TOKEN` configuré (v3, propre, sans newline parasite)

### 4. Bot Discord
- Application Discord créée (`LTD Sandy Shores Bot`)
- Invité sur le serveur avec permissions `View Channels` + `Read Message History`
- 7 parsers structurés : `inventory`, `service`, `facture`, `essence`, `depense`, `paie`, `coffre`
- 8 canaux logs bruts (pour archives)
- Hébergement **Railway 24/7** (gratuit, ~$5/mois de crédits inclus)
- Diagnostic permissions intégré (au démarrage, vérifie chaque canal)

### 5. Frontend
- Déployé sur GitHub Pages avec workflow auto sur push
- Domaine `lahagragaming93-debug.github.io` autorisé dans Firebase Auth
- Repo public (nécessaire pour GitHub Pages gratuit)
- Chart.js intégré pour graphiques dashboard

### 6. Données initialisées
- **8 stations essence** créées avec capacités + prix + seuils 20% :
  - Senora Way - Rex's Diner (10 000 L, 5 $)
  - Route 68 LTD (7 500 L, 5 $)
  - Route 68 (10 000 L, 5 $)
  - Panorama Drive - Aérodrome Sandy Shores (5 000 L, 5 $)
  - Palomino Freeway - Favélas (15 000 L, 6 $)
  - Clinton Avenue - Vinewood (15 000 L, 5,50 $)
  - Cholla Springs Avenue (5 000 L, 4,50 $)
  - Algonquin Boulevard (5 000 L, 4,50 $)
- **Catalogue 53 produits** initialisé avec prix achat + vente (basés sur tarifs ancien patron, règle 2,5× coût de revient)
- 4 produits **sans prix d'achat** à compléter : Menu Burger ice tea, Canne à pêche, Croquette, Sac en Jute

### 7. Audit + corrections (8 fixes)
- 🔴 Rules Firestore `/users` restreintes (lecture sensible)
- 🔴 Race condition `quotaPompiste` corrigée (`FieldValue.increment()` atomique)
- 🔴 Logique date `clotureHebdo` corrigée (cron lundi 00h, semaine lun→dim complète)
- 🔴 Limites sur queries (`listUsers` 200, `listProduits` 500)
- 🟠 Audit trail des prix (collection `historiquePrix` append-only)
- 🟠 Validation inputs config admin (refuse quotas ≤ 0)
- 🟠 Toasts d'erreur explicites (9 endroits, plus de « Erreur. » générique)
- 🟢 Cleanup policy Artifact Registry

### 8. 4 features bonus
- ✨ **Notifications Discord** : alertes postées sur webhook configuré (rupture, masse > 90%, etc.)
- ✨ **Conservation 100% historique** : suppression de la purge agressive (TTE = MIN 6 sem, on garde tout)
- ✨ **Dashboard Chart.js** : 2 graphiques (ventes par jour, top 5 produits)
- ✨ **Page Mes paies** : historique paies reçues + KPIs perso pour chaque employé
- 🔧 Résolution auto des IDs Firebase (vendeurId via idDiscord, beneficiaireId via idPerso)

### 9. Comptes créés
| Email | Rôle | Personne |
|-------|------|----------|
| `lahagragaming93@gmail.com` | Patron | toi (boulalahagra, intendant temporaire) |
| `maximegreaume@gmail.com` | Patron | Maxime BLAKE (vrai patron RP) |

### 10. Sécurité — verrouillage final
- Inscription publique **fermée** à 3 niveaux : UI (onglet retiré), JS (throw immédiat), rules Firestore (`allow create: isDirection()` uniquement)
- Tous les futurs comptes seront créés via **Administration** par un Patron

### 11. Documentation incluse (`docs/`)
- `01-setup-firebase.md` — création projet + déploiement règles + Functions
- `02-setup-discord-bot.md` — config bot + hébergement
- `03-setup-github-pages.md` — déploiement frontend
- `04-premier-compte.md` — init données + premier patron
- `05-guide-utilisation.md` — guide quotidien direction + employés
- `06-architecture.md` — schéma flux + collections Firestore
- `07-transmission.md` — passation au vrai patron (Firebase, GitHub, Railway, Discord)
- **`JOURNAL.md`** — ce document

---

## 📋 Ce qui reste à faire (TODO)

### Priorité haute
- [ ] **Compléter 4 prix d'achat** : Menu Burger ice tea, Canne à pêche, Croquette, Sac en Jute (Stocks → Modifier)
- [ ] **Configurer le webhook Discord pour alertes** (Admin → Config → URL Webhook). Étapes :
  1. Créer un canal `#🚨-alertes-app` sur Discord
  2. Modifier le canal → Intégrations → Webhooks → Nouveau webhook → copier l'URL
  3. Coller dans Admin → Configuration globale → Webhook Discord

### Priorité moyenne
- [ ] **Liste produits complète à intégrer** (le user attend la liste finale de l'ancien patron)
  - Produits identifiés à ajouter au catalogue : Pioche, Jerrican, Bac jardinage, Pain à burger, Crème fraîche, Outil, Baguette, Barre chocolat caramel, Perçeuse manuel, Bidon vide, Visserie, Bobine de cuivre
  - Vérifier les écarts de prix avec mise à jour mars 2026 (acier 40$ → 60$)
- [ ] **Créer les comptes employés** : Co-Patron (si Maxime en veut un), DRH, responsables (vente, pompiste), vendeurs, pompistes
  - Pour chaque : prénom, NOM RP, email, **ID Discord**, **ID Perso** (in-game)
  - Sans IDs Discord/Perso, les paies et ventes ne seront pas attribuées correctement
- [ ] **Budget alerte Firebase** (5 €/mois, par sécurité) → console GCP → Billing

### Priorité basse (nice to have)
- [ ] Page « Mon profil » pour que chaque utilisateur édite ses propres infos sans passer par Admin
- [ ] Rapport PDF mensuel automatique (pour TTE / admin RP)
- [ ] Stats avancées : graphique 6 mois, comparaison N vs N-1
- [ ] Conciliation bancaire (rapprochement entre `paie` Discord et `salaireDecide`)
- [ ] Mode hors ligne renforcé (Service Worker)

### À l'arrivée du moment
- [ ] **Transmission technique au vrai patron** → suivre `docs/07-transmission.md`
  - Firebase, GitHub, Railway, Discord Bot dans cet ordre
  - Suppression du compte intendant en dernier

---

## 🔄 Comment reprendre le travail

### Pour reprendre avec Claude Code (recommandé)

1. **Ouvrir un terminal** (PowerShell ou Bash)
2. Aller dans le dossier du projet :
   ```
   cd "C:\Users\antho\Desktop\LTD Sandy Shores"
   ```
3. Lancer Claude Code :
   ```
   claude
   ```
4. La **mémoire est automatiquement chargée** — je sais qui tu es, ce qu'on a fait, où on en est. Tu peux me dire simplement « on reprend » ou « voici la liste de produits qu'on attendait ».

### Pour vérifier l'état du système

| Quoi | Où |
|------|-----|
| L'app fonctionne ? | https://lahagragaming93-debug.github.io/ltd-sandy-shores/ |
| Le bot tourne sur Railway ? | https://railway.com → Deployments → Logs |
| Les Functions tournent ? | https://console.firebase.google.com/project/ltd-sandy-shores-f3919/functions |
| Des données arrivent dans Firestore ? | https://console.firebase.google.com/project/ltd-sandy-shores-f3919/firestore |
| Des erreurs récentes ? | `firebase functions:log` (depuis le dossier `firebase/`) |

### Pour reprendre sans Claude (à la main)

Tous les fichiers importants sont commentés et organisés. Voici les points d'entrée :

| Tu veux modifier… | Va voir… |
|-------------------|----------|
| L'apparence (thème, couleurs, mise en page) | `public/css/western.css` |
| Une page (logique métier) | `public/js/pages/<nom>.js` (ex: `dashboard.js`, `stocks.js`) |
| Le calcul de paie | `public/js/utils/paie.js` |
| Les permissions par rôle | `public/js/utils/permissions.js` |
| Le catalogue produits par défaut | `public/js/data/produits.js` |
| Le bot Discord (parsers, dispatch) | `discord-bot/index.js` + `discord-bot/parsers/` |
| Les Cloud Functions (clôture, alertes, ingest) | `firebase/functions/index.js` |
| Les règles de sécurité Firestore | `firebase/firestore.rules` |

### Pour déployer une modif

```bash
# Frontend (auto-déploiement sur push)
git add public/...
git commit -m "MAJ frontend"
git push

# Cloud Functions (manuel)
cd firebase
firebase deploy --only functions

# Règles Firestore (manuel)
firebase deploy --only firestore:rules

# Bot Discord (auto-redéploiement Railway sur push de discord-bot/)
git add discord-bot/...
git commit -m "MAJ bot"
git push
```

---

## 🚨 Points d'attention

- **Token Discord** stocké dans `.env` du bot (Railway variables d'env, pas commit sur GitHub)
- **Secret Firebase** `LTD_BOT_INGEST_TOKEN` (v3, configuré via Firebase Secrets Manager — JAMAIS le mettre en clair)
- **Le repo est public** — ne jamais commit de credentials (le `.gitignore` les exclut déjà)
- **Plan Blaze** activé sur Firebase — coût attendu 0 €, mais surveiller la conso si volume explose
- **Maxime BLAKE** est le vrai patron — toi tu te retireras quand tout sera stable (suivre `docs/07-transmission.md`)

---

## 📞 En cas de souci au redémarrage

- **Site ne charge pas** → vérifier https://www.githubstatus.com/ (incident GitHub Pages)
- **Login refusé** → vérifier que `lahagragaming93-debug.github.io` est bien dans Firebase Auth → Authorized domains
- **Bot ne remonte plus rien** → Railway logs → vérifier que le bot s'est connecté + permissions canaux Discord
- **Erreur 401 sur botIngest** → token Firebase obsolète, régénérer (cf. `feedback_firebase_secrets.md` en mémoire)
- **Quelque chose est cassé après une modif** → `git log --oneline | head -5` pour voir les derniers commits, `git revert <sha>` pour annuler

---

## 🤠 Mot de la fin

Tout tourne, tout est sécurisé, tout est documenté. Le système peut fonctionner sans intervention pendant des semaines.

Demain, tu reprends d'où tu veux : intégrer les nouveaux produits quand tu auras la liste, créer des comptes employés, peaufiner le visuel, ou ajouter des features. La plateforme est prête pour la production. 🌵

---

> **Pour Claude (futur moi) qui lira ce document** : la mémoire dans `C:\Users\antho\.claude\projects\C--Users-antho-Desktop-LTD-Sandy-Shores\memory\` contient les détails techniques (URLs Firebase, identité du vrai patron, traps Windows pour les secrets, contexte de transmission). Lire le fichier `MEMORY.md` à l'arrivée pour reprendre dans le bon contexte.
