# 16 — Pour Claude qui reprend ce projet

> Hello Claude. Tu reçois ce dossier dans une nouvelle conversation. Voici les règles d'engagement, les pièges à éviter et la méthode de travail attendue par le user.

---

## 👋 Qui est ton user

- **Personne** : développeur indépendant, signature `BLATV`
- **Email** : lahagragaming93@gmail.com (registered Firebase / GitHub)
- **Profil** : il a déjà construit le squelette LTD Sandy Shores en collaborant avec une version précédente de toi. Il connaît le code, les contraintes RP, les pièges. Il n'a pas besoin que tu réexpliques le basique.
- **Style attendu** : tutoyer, direct, peu de blabla, exécuter (commits, push, deploy) sans demander la permission à chaque fois, livrer des chiffres / commandes / fichiers concrets.

---

## 🎯 Sa mission actuelle

Il veut **cloner le squelette LTD Sandy Shores vers un nouveau LTD** :
- Même architecture technique (Firebase + GitHub Pages + Discord bot + Google Sheets)
- Mêmes mécaniques métier (clôture hebdo, paies, snapshots, conformité TTE)
- **DA visuelle différente** (à définir avec lui : western, mafia, cyberpunk, autre ?)
- **Nouvelle infra** (projet Firebase dédié, Sheet dédié, bot Discord dédié, repo GitHub dédié)

L'objectif final : un nouveau LTD opérationnel, prêt à servir un autre patron RP (ou lui-même s'il en reprend un).

---

## 📋 Première interaction recommandée

Quand le user te dit "salut, on commence le nouveau LTD" (ou équivalent), réponds dans cet esprit :

> "Salut. J'ai parcouru le dossier handoff. Avant de foncer, 4 questions cadrantes :
>
> 1. **Nom du nouveau LTD ?** (sera utilisé partout : sidebar, README, Sheet, etc.)
> 2. **DA visuelle ?** — Garder le western (palette saloon ivoire/rouge/doré) ? Ou refonte (préciser : mafia, cyberpunk, corporate, etc.) ?
> 3. **Comptes externes** : tu as déjà créé le projet Firebase + Google Sheet + bot Discord + repo GitHub ? Ou je t'accompagne ?
> 4. **Serveur RP cible** : toujours Sandy Shores RPG (mêmes règles TTE, même format FaabHook) ? Ou autre serveur ?"

Une fois les réponses, propose un **plan en 5-7 grosses étapes** (voir `11-setup-pas-a-pas.md`). Valide chaque étape avant de passer à la suivante.

---

## ⚖ Règles d'engagement strictes (héritées de la conversation source)

### Autonomie d'exécution
- **OUI tu peux** : commit, push, lancer scripts Node CLI, déployer Firebase Functions, modifier fichiers
- **NON tu ne peux PAS** : demander au user de "lancer cette commande dans son terminal" — c'est TOI qui exécutes. Lui valide après coup s'il veut.
- Source : `feedback_autonomie_execution` mémoire de la conv précédente

### Style code
- **Pas d'emoji** dans le code, commits, docs (sauf si user en met explicitement)
- **Pas de commentaires inutiles** — un identifiant bien nommé vaut mieux qu'un commentaire
- **Pas de tests** sauf si demandé — c'est un projet RP solo
- **Pas d'over-engineering** : pas de design pattern complexe, pas d'abstraction prématurée, pas de fallbacks pour cas qui n'arrivent jamais
- **Pas de backwards-compat** non sollicitée : si tu changes une API, change le caller en même temps

### Documentation
- **OBLIGATOIRE** : toute modif UI doit MAJ `public/guide/*.md` dans le MÊME commit
- Source : `feedback_maintenir_docs` mémoire

### Règles TTE
- **JAMAIS d'auto-classification déductibilité** : le code suggère via mapping fournisseurs, le patron valide. Pas d'algorithme qui décide à sa place.
- Source : `feedback_tte_decision_patron` mémoire

### Terminologie
- **Semaines** : utiliser weekKey `YYYY-MM-DD` (du lundi) OU label ISO `S20 2026`. NE PAS utiliser de raccourcis maison type "W18".
- Source : `feedback_nomenclature_semaines` mémoire

### Calculs
- **Salaire vendeur** = `CA particulier × commission` (pas bénéfice). Plafond CA = 100k$ par grade.
- **Bénéfice net** = `CA total - dépenses totales - masse salariale`. Afficher comme "CA − dépenses − salaires versés".
- Source : `feedback_salaire_vendeur_sur_ca` mémoire

---

## 🧠 Mémoires à reconstituer (si possible)

Si tu peux créer / hériter des mémoires suivantes dans la nouvelle conv :

| Mémoire | Type | Description |
|---|---|---|
| `projet_nouveau_ltd` | projet | Nom, DA, contexte du nouveau LTD |
| `references_infrastructure` | reference | URLs Firebase, GitHub, Functions du nouveau projet |
| `feedback_autonomie_execution` | feedback | Tu exécutes, pas le user |
| `feedback_maintenir_docs` | feedback | UI = MAJ guide même commit |
| `feedback_tte_decision_patron` | feedback | JAMAIS d'auto-classification |
| `feedback_nomenclature_semaines` | feedback | weekKey ou S20, pas W18 |
| `feedback_salaire_vendeur_sur_ca` | feedback | CA × commission, pas bénéfice |
| `references_tte_*` | reference | Règles TTE actuelles |

---

## 🗂 Plan de lecture du dossier (par toi, Claude)

Pour comprendre le projet rapidement (30 min de lecture) :

1. **`00-INDEX.md`** — sommaire général
2. **`01-vision-et-stack.md`** — produit + tech
3. **`03-features.md`** — qu'est-ce qui marche
4. **`11-setup-pas-a-pas.md`** — comment bootstrap
5. **`16-pour-claude-suivant.md`** — toi (ce fichier)

Pour creuser un sujet précis :
- Frontend → `04-pages-frontend.md` + `12-personnalisation-da.md`
- Backend → `05-cloud-functions.md` + `06-firestore-schema.md`
- Bot Discord → `07-discord-bot.md`
- Sheet → `08-google-sheets.md`
- Permissions → `09-permissions-acl.md`
- TTE → `10-tte-rules.md`
- Scripts → `13-scripts-cli.md`
- Pièges → `14-pieges-known-issues.md`
- Vocabulaire RP → `15-glossaire-rp.md`

Le fichier `_ARCHIVE-handoff-v1-monobloc.md` est l'ancienne version monobloc du handoff, gardée comme référence rapide condensée.

---

## 🚨 Pièges à connaître ABSOLUMENT

### Top 5 à mémoriser
1. **Timezone UTC vs Paris** — TOUJOURS utiliser les helpers `toParisWall` / `parisWallToUtcGlobal`, JAMAIS `toISOString().slice(0,10)` pour calculer un weekKey
2. **Firebase secrets sur Windows** — utiliser `--data-file <fichier_sans_newline>`, JAMAIS `echo "x" | firebase secrets:set`
3. **`firebase/functions/lib/` gitignored** — `git add -f <fichier>` pour les nouveaux modules
4. **Cache IMPORTDATA ~1h** — bouton "🔄 Rafraîchir doc compta" ou `force-refresh-sheet.js`
5. **`buildFormatRequests` ne reçoit pas `data`** — JAMAIS y utiliser une variable de `chargerDonnees`, sinon ReferenceError → crash batch → Dashboard cassé

Détails dans `14-pieges-known-issues.md`.

---

## 🏗 Structure de travail recommandée

### Pour un changement simple (fix, MAJ texte guide, etc.)
1. Comprendre la demande
2. Localiser le fichier impacté (grep / glob)
3. Lire le contexte (Read)
4. Edit
5. `node --check` si JS
6. Git commit + push
7. Si frontend → push GitHub suffit (GitHub Pages republie). Si backend → `firebase deploy --only functions:<name>`
8. Reporter au user (en 1-2 lignes)

### Pour une nouvelle feature
1. **Toujours proposer un plan avant de coder** (3-7 étapes)
2. Valider le plan avec le user
3. Implémenter étape par étape (commit par étape si gros)
4. MAJ docs guide + JOURNAL en même temps
5. Si feature backend → bump VERSION dans `version.js`, MAJ JOURNAL + ROADMAP
6. Tester en local si possible (scripts CLI)
7. Deploy + valider en prod
8. Reporter au user

### Pour parallélisation (gros chantiers)
Le user accepte les agents en background si la tâche est conséquente :
- Agent général : refacto multi-fichiers
- Worktree isolé pour éviter conflits si plusieurs agents
- Merger les worktrees à la fin (copier les fichiers vers main, résoudre les conflits manuellement avec Edit)

---

## 📝 Conventions commits

Format observé dans le repo :
```
Feat vX.Y.Z : titre court

- Bullet 1
- Bullet 2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Préfixes : `Feat`, `Fix`, `Docs`, `Refactor`, `Style`. En français. Pas d'emoji.

---

## 🚫 Ce que tu NE dois PAS faire

- ❌ Casser ce qui marche en prod sur Sandy Shores (le user a précisé plusieurs fois "ne touche pas au site/compta actuels")
- ❌ Ajouter du code "au cas où" / pour des features non demandées
- ❌ Réécrire en TypeScript / React / autre framework — le user a choisi vanilla pour des raisons (cf `01-vision-et-stack.md`)
- ❌ Mettre des tests si pas demandé
- ❌ Commit des secrets ou IDs sensibles
- ❌ Faire des hypothèses sur la DA du nouveau LTD — demander
- ❌ Modifier le squelette source Sandy Shores depuis le nouveau projet (chaque projet est indépendant)

---

## ✅ Quick wins recommandés en début de session

Quand le user te confirme qu'on commence, dans cet ordre :

1. **`git status`** + `git log --oneline -5` pour vérifier qu'on est dans un état clean et à jour
2. **`firebase use`** pour vérifier qu'on est bien sur le bon projet Firebase (et pas accidentellement sur Sandy Shores)
3. **Faire un commit "Initial fork from Sandy Shores v1.7.0"** dès qu'on a clone et adapté la config minimale
4. **Pousser au plus vite un MVP** : login fonctionne + dashboard vide affiché. Confiance immédiate.
5. **Puis itérer sur les features** une par une

---

## 📊 Métriques d'effort

D'après l'expérience Sandy Shores :
- **Setup complet from scratch** : 6-10h (voir `11-setup-pas-a-pas.md`)
- **Rebrand DA niveau 1** (logo, naming) : ~1h
- **Rebrand DA niveau 2** (refonte palette + thème) : ~3-4h
- **Adaptation TTE** (si autre serveur RP) : ~2h
- **Test E2E complet avant ouverture** : ~1h

---

## 🎁 Bonus : commandes git utiles

```bash
# Voir ce qui a changé depuis le dernier commit
git diff

# Status court
git status -s

# Log compact
git log --oneline --graph -20

# Annuler un commit pas encore pushé
git reset --soft HEAD~1

# Revert un commit pushé
git revert <sha>
git push

# Voir le diff d'un fichier dans un commit
git show <sha> -- path/to/file

# Diff entre branches / commits
git diff main..feature-branch -- path/to/file

# Lister les fichiers modifiés dans un commit
git show --stat <sha>
```

---

## 🤝 Bonne reprise

Tu as tout le contexte. Le user est sympa, direct, technique. N'hésite pas à proposer, à challenger ses idées si tu vois mieux, mais respecte ses décisions finales (notamment sur la DA et le scope).

Bon courage, et fais-en sorte que ce nouveau LTD soit aussi propre que celui de Sandy Shores. 🤠
