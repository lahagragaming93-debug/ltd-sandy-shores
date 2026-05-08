# 1 — Setup Firebase

> Durée estimée : 20 minutes
> Niveau : facile (interface web)

## Prérequis

- Un compte Google
- Node.js installé (v20+) — vérifier avec `node --version`

## Étape 1 : Créer le projet Firebase

1. Aller sur [console.firebase.google.com](https://console.firebase.google.com)
2. **Créer un projet** → nom suggéré : `ltd-sandy-shores`
3. Désactiver Google Analytics (non nécessaire)
4. Attendre la fin de la création

## Étape 2 : Activer Authentication

1. Menu de gauche → **Authentication** → **Get started**
2. Onglet **Sign-in method** → activer **Email/Password** (sans le lien magique)
3. Sauvegarder

## Étape 3 : Activer Firestore

1. Menu de gauche → **Firestore Database** → **Create database**
2. Choisir le mode **Production** (les règles seront déployées plus tard)
3. Région : **eur3 (europe-west)** ou **europe-west1**
4. Activer

## Étape 4 : Récupérer la configuration web

1. Roue dentée (en haut à gauche) → **Project settings**
2. Onglet **General** → tout en bas, section **Your apps**
3. Cliquer sur l'icône **</>** (web)
4. Nom de l'app : `LTD Sandy Shores Web` → enregistrer
5. **Copier la configuration** (objet `firebaseConfig`) :

   ```js
   const firebaseConfig = {
     apiKey:            "AIza...",
     authDomain:        "ltd-sandy-shores.firebaseapp.com",
     projectId:         "ltd-sandy-shores",
     storageBucket:     "ltd-sandy-shores.appspot.com",
     messagingSenderId: "123456789012",
     appId:             "1:123456789012:web:abc..."
   };
   ```

6. **Coller dans le fichier** `public/js/firebase-config.js` à la place des
   valeurs `REMPLACER_PAR_VOTRE_API_KEY`

## Étape 5 : Installer Firebase CLI et déployer les règles + Functions

```bash
npm install -g firebase-tools
firebase login
cd firebase
firebase use --add        # → choisir votre projet ltd-sandy-shores
firebase deploy --only firestore:rules,firestore:indexes
```

## Étape 6 : Déployer les Cloud Functions

```bash
cd firebase/functions
npm install
cd ..
firebase deploy --only functions
```

> ⚠️ **Plan tarification** : les Cloud Functions nécessitent le plan **Blaze**
> (pay-as-you-go). Le quota gratuit couvre largement l'usage typique
> (clôture hebdo + alertes + ~10 ingestions/min). Coût attendu : 0 €/mois.

## Étape 7 : Configurer le secret pour le bot

Le bot Discord enverra ses données à Firebase via un endpoint protégé. On
définit un token partagé :

```bash
# Générer un token aléatoire
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Stocker comme secret Firebase
firebase functions:secrets:set LTD_BOT_INGEST_TOKEN
# (coller le token quand demandé)

# Redéployer pour que le secret soit pris en compte
firebase deploy --only functions
```

➡ **Conserver ce token** : il sera réutilisé dans `.env` du bot Discord.

## Étape 8 : Récupérer l'URL de la fonction `botIngest`

```bash
firebase functions:list
```

Noter l'URL de `botIngest` (format `https://botingest-xxx.europe-west1.run.app`).
Elle sera mise dans `INGEST_URL` du bot Discord.

## Vérification

- Le frontend doit fonctionner localement avec `cd public && npx serve`
- La console Firebase doit afficher les collections une fois le premier
  utilisateur créé (étape `04-premier-compte.md`)

## Étape suivante

➡ [02-setup-discord-bot.md](02-setup-discord-bot.md)
