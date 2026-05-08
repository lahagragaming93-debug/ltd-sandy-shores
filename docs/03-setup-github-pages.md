# 3 — Déploiement GitHub Pages

> Durée estimée : 10 minutes

## Étape 1 : Créer le dépôt GitHub

1. [github.com/new](https://github.com/new) → repository **privé** recommandé
2. Nom suggéré : `ltd-sandy-shores`
3. Ne pas initialiser avec README (vous avez déjà des fichiers)

## Étape 2 : Pousser le code

Depuis le dossier du projet :

```bash
git init
git add .
git commit -m "Init plateforme LTD Sandy Shores"
git branch -M main
git remote add origin https://github.com/<votre-pseudo>/ltd-sandy-shores.git
git push -u origin main
```

> ⚠️ **Vérifier avant de pousser** :
> - `public/js/firebase-config.js` contient bien votre vraie config Firebase
> - `discord-bot/.env` est bien dans `.gitignore` (il l'est par défaut)

## Étape 3 : Activer GitHub Pages

1. Sur GitHub → votre dépôt → **Settings** → **Pages** (menu de gauche)
2. **Source** : sélectionner **GitHub Actions**
3. (Pas besoin de configurer plus, le workflow `.github/workflows/deploy.yml` est déjà là)

## Étape 4 : Premier déploiement

Le push de l'étape 2 déclenche automatiquement le workflow.

1. Onglet **Actions** sur GitHub → vérifier que `Deploy frontend` est en cours
2. Une fois terminé (vert), l'URL est visible dans **Settings → Pages**
3. Format : `https://<votre-pseudo>.github.io/ltd-sandy-shores/`

## Étape 5 : Ajouter le domaine autorisé dans Firebase

Important pour que l'auth fonctionne depuis GitHub Pages :

1. Console Firebase → **Authentication** → onglet **Settings**
2. Section **Authorized domains** → **Add domain**
3. Ajouter `<votre-pseudo>.github.io`

## Étape 6 : Tester

Ouvrir l'URL GitHub Pages dans un navigateur. La page de connexion doit
s'afficher avec le thème western (rouge/sable/noir).

## Mises à jour

Toute modification dans `public/` poussée sur `main` redéploie automatiquement.

```bash
git add public/...
git commit -m "MAJ frontend"
git push
```

## Dépannage

- **Page blanche** → ouvrir la console DevTools (F12) → l'erreur indique
  généralement une mauvaise valeur dans `firebase-config.js`
- **`auth/unauthorized-domain`** → étape 5 oubliée
- **Modules non trouvés** → vérifier que tous les chemins sont relatifs
  (commencent par `./` ou `../`, pas `/`)

## Étape suivante

➡ [04-premier-compte.md](04-premier-compte.md)
