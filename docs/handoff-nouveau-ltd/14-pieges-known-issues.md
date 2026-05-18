# 14 — Pièges connus & known issues

> Cheatsheet des bugs récurrents, edge cases et gotchas. Lecture obligatoire avant de toucher au code en production.

---

## ⏰ Timezone (UTC vs Paris)

**Le piège #1 du projet.** Les Cloud Functions tournent en UTC. Les calculs de "semaine RP" et "fenêtre paie" doivent toujours se faire en heure Paris.

### Symptôme typique
- KPI semaine en cours pollué par paies de la semaine précédente
- Onglet snapshot avec mauvais titre (`11-18 mai` au lieu de `11-17 mai`)
- Cron clôture qui rejette à tort un clic valide en disant "trop tôt"
- Filtre `weekKeyAttribuee` qui ne matche rien

### Cause profonde
- `dateDebut.toISOString().slice(0,10)` → shift en UTC. En CEST (UTC+2), lundi 00:00 Paris = dimanche 22:00 UTC → `.toISOString()` retourne `'2026-05-10T22:00:00.000Z'` → `.slice(0,10)` donne `'2026-05-10'` ≠ `'2026-05-11'` (le weekKey attendu).
- `dim 23:59:59.999 Paris` stocké en UTC `22:00:00.998Z` → conversion Paris donne `00:00:00.998 du lundi suivant` (à cause des 998ms qui passent au lendemain).

### Solutions appliquées dans le code

**Helper `toParisWall(d)`** dans `index.js` :
```js
function toParisWall(d) {
  const s = d.toLocaleString('sv-SE', { timeZone: 'Europe/Paris', hour12: false });
  return new Date(s.replace(' ', 'T') + 'Z');
}
```
→ Convertit un Date UTC en Date dont les composantes UTC = horloge Paris (`getUTCHours()` retourne l'heure Paris).

**Helper `parisWallToUtcGlobal(parisWall)`** : inverse, prend une "horloge Paris" et retourne le vrai UTC. Itère 3x pour gérer le DST.

**Format weekKey local** (pas UTC) :
```js
const weekKey = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
```

**Recalculer le dimanche depuis le lundi** (pas depuis dateFin Firestore) :
```js
const dim = new Date(lundi);
dim.setHours(12, 0, 0, 0);  // midi pour éviter edge cases TZ
dim.setDate(dim.getDate() + 6);
```

### Règle d'or
**Avant tout calcul de date pour les semaines RP, demander : "est-ce que je suis en UTC ou en Paris ?"** Si tu doutes, utilise les helpers existants.

---

## 🔐 Firebase secrets sur Windows PowerShell

### Symptôme
Le secret défini via `echo "x" | firebase secrets:set NAME` contient un `\r\n` parasite à la fin, causant des erreurs d'auth.

### Solution
Utiliser **`--data-file <fichier>`** :
```bash
# Créer un fichier SANS newline final
echo -n "ma-valeur-secrete" > /tmp/secret.txt
firebase functions:secrets:set NAME --data-file /tmp/secret.txt
```

Ou sur Windows :
```powershell
Set-Content -NoNewline -Path C:\temp\secret.txt -Value "ma-valeur-secrete"
firebase functions:secrets:set NAME --data-file C:\temp\secret.txt
```

Mémoire associée : `feedback_firebase_secrets`.

---

## 📁 `firebase/functions/lib/` gitignored

### Symptôme
Tu crées un nouveau module dans `firebase/functions/lib/` mais il n'apparaît pas dans `git status`.

### Cause
Le `.gitignore` du repo contient `firebase/functions/lib/` (héritage TypeScript build).

### Solution
Force-add :
```bash
git add -f firebase/functions/lib/<mon-nouveau-module>.mjs
```

Les modules déjà trackés (`dashboard-core.mjs`, `paie-calc.mjs`, etc.) ont été force-add à leur création. À reproduire pour les nouveaux.

---

## 📊 Cache IMPORTDATA Google Sheets

### Symptôme
Tu modifies des données Firestore, le Sheet `Ventes` / `Dépenses` ne se met pas à jour.

### Cause
Google Sheets cache le résultat de `=IMPORTDATA(url)` pendant ~1h.

### Solution
Modifier le param `&_t=<timestamp>` dans la formule pour casser le cache :
- Bouton "🔄 Rafraîchir doc compta" sur `/comptabilite` (appelle `forceRefreshImportData` côté serveur)
- Ou en local : `node scripts/force-refresh-sheet.js`
- Ou manuel : éditer la cellule A1 du Sheet, changer un caractère, restaurer

---

## 🐛 ReferenceError dans `buildFormatRequests` du Dashboard

### Symptôme historique (corrigé v1.6.1)
Le Dashboard du Sheet s'affichait "tout nu" (juste les valeurs, sans aucun formatage). Erreur : `cumulBeneficeNet is not defined`.

### Cause
`buildFormatRequests(sheetId, rows)` ne reçoit pas `data`. Si on utilise une variable de `chargerDonnees` dedans → ReferenceError → crash du batch → aucun formatage appliqué.

### Solution
Inférer depuis les valeurs déjà écrites dans `rows` :
```js
const valeurCumul = String(rows[17]?.[0] || '');
const cumulPositif = !valeurCumul.startsWith('-');
```

### Règle d'or
`buildFormatRequests` ne doit **dépendre QUE de `rows` et `sheetId`**. Pour avoir besoin d'une donnée de `chargerDonnees`, soit l'écrire dans `rows` d'abord, soit passer `data` en 3e argument.

---

## 📅 "Invalid Date" dans historique semaines (Sheet)

### Symptôme historique
Dans le HISTORIQUE des semaines du Dashboard, les colonnes Date début / Date fin affichaient "Invalid Date".

### Cause
`s.dateDebut` est un **Firestore Timestamp objet** (côté admin SDK), pas une string parseable par `new Date()`.

### Solution
```js
const dDeb = s.dateDebut?.toDate?.() || (s.dateDebut ? new Date(s.dateDebut) : null);
const dFin = s.dateFin?.toDate?.()   || (s.dateFin   ? new Date(s.dateFin)   : null);
```

`Timestamp.toDate()` retourne un `Date` JS valide.

---

## 👤 Compte employé supprimé → trace perdue

### Symptôme historique
Patron a supprimé un compte employé après une clôture. Sa paie versée n'apparaît plus nulle part, créant un écart inexplicable entre estimations et paies versées.

### Cause
Suppression de doc `/users/{uid}` casse les liens depuis `/paies` (champ `beneficiaireId` orphelin). Idem pour `/paiesEstimees`.

### Solution implémentée (v1.6.0+)
- **Snapshot Option B** : `/paiesEstimees/{weekKey}_{userId}` fige nom + montant **au moment de la clôture**. Survit à la suppression du compte.
- **Onglet Sheet `Semaine N`** : section Paies inclut colonne **ID Discord bénéf.** pour conserver le matricule traçable.

### Règle d'or
**Si tu dois supprimer un compte**, attends qu'au moins UNE clôture soit passée pour figer son historique dans les snapshots.

---

## 🤖 Bot Discord — doublons après redémarrage

### Symptôme
Tu redémarres le bot, des ventes/paies sont ré-enregistrées en doublon.

### Cause
Le bot ne stocke pas d'offset. Si tu lances un script qui rejoue l'historique Discord, ça réinjecte tout.

### Solution
- Pour le bot live : pas de souci (event `messageCreate` ne se déclenche que pour les nouveaux messages)
- Pour les scripts de rattrapage : implémenter dédup par `factureId` (ventes) ou clé composite (paies). C'est déjà fait côté Cloud Function `botIngest` pour les ventes (skip si `factureId` existe déjà).

---

## 🔄 Conflit edit Sheet manuel vs cron

### Symptôme
Tu édites manuellement une cellule du Dashboard, ça disparaît la minute suivante.

### Cause
Le cron `dashboardKeepAlive` (every minute) régénère le Dashboard si A1 est vide ou corrompue.

### Solution
**Ne JAMAIS éditer manuellement le Dashboard**. Toute info à ajouter doit passer par `dashboard-core.mjs` (re-déploiement Functions ensuite).

---

## ⏱ Cron clôture qui ne tourne pas

### Symptômes possibles
- Lundi matin : pas de clôture, pas d'onglet snapshot, dashboard inchangé
- Cron `clotureHebdo` listé comme `disabled` ou `failed` dans Firebase Console

### Causes possibles
- **Secret `DASHBOARD_SA_KEY` manquant** ou invalide
- **Quota Cloud Functions dépassé** (rare en plan Blaze)
- **Erreur dans `index.js`** au déploiement (syntaxe, import manquant)
- **Service account révoqué** ou perte d'accès au Sheet

### Solutions
1. Vérifier les logs : `firebase functions:log --only clotureHebdo`
2. Vérifier que les secrets sont bien set : `firebase functions:secrets:access DASHBOARD_SA_KEY` (Liste : `firebase functions:secrets:get` ? cf docs)
3. Redéployer : `firebase deploy --only functions:clotureHebdo`
4. Lancer manuellement le bouton 🔒 patron pour faire la clôture (mode fallback)

---

## 🔢 Numéro de facture IG vs site

### Symptôme
Dans le Sheet, certaines lignes ont `N° Facture IG = M20260518-0040` (format site) au lieu du vrai numéro IG `1923212`.

### Cause
Le filtre du snapshot inclut les ventes `source='manuelle'` qui ont un factureId site (préfixe M-).

### Solution (v1.7.0)
Filtre stricte `source === 'discord'` dans `snapshot-sheet-semaine.mjs` → seules les ventes du bot Discord apparaissent avec leur vrai numéro IG.

Les ventes manuelles non-dédupliquées (rares cas où le bot n'a pas remonté) sont alors invisibles dans le snapshot. Acceptable car l'audit IRS se base sur les factures IG officielles.

---

## 🔁 Renommage onglet live qui crée un doublon

### Symptôme
Après le cron lundi 00h00, on a 2 onglets `Ventes Semaine 20 (...)` et `Ventes Semaine 21 (...)` au lieu d'un seul.

### Cause
Si la fonction `renameLiveOnglets` cherche `^Ventes( |$)` mais que l'ancien titre est `Ventes Semaine 20 (...)`, elle ne le matche que partiellement et crée un nouvel onglet au lieu de renommer.

### Solution actuelle (v1.7.0)
Regex `/^Ventes( |$)/` matche bien `Ventes Semaine 20 (...)` car le pattern `( |$)` accepte un espace après. Idempotent (skip si titre déjà correct).

Si tu modifies le format du titre, **vérifier que la regex matche toujours l'ancien format** pour permettre le rename.

---

## 💸 KPI "Salaires versés" à 0 sur /rh semaine clôturée

### Symptôme historique (corrigé v1.6.1)
Sur `/rh`, sélecteur "Semaine 20 du 11/05 au 17/05" → tous les snapshots cochés Versé, mais KPI **Salaires versés** affiche 0 $.

### Cause
`listPaiesSemaine(debut, fin)` calculait `wKeyCible = dateDebut.toISOString().slice(0,10)` → shift UTC en Paris CEST → wKeyCible = `'2026-05-10'` au lieu de `'2026-05-11'` → filtre `weekKeyAttribuee === wKeyCible` rejetait toutes les paies.

### Solution
Accepter un param `weekKey` explicite, passé depuis `rh.js` (`wId`) :
```js
export async function listPaiesSemaine(dateDebut, dateFin, weekKey = null) {
  const wKeyCible = weekKey || `${dateDebut.getFullYear()}-${String(dateDebut.getMonth()+1).padStart(2,'0')}-${String(dateDebut.getDate()).padStart(2,'0')}`;
  ...
}
```

---

## 🛒 Vente IG non remontée par le bot

### Symptôme
Une vente IG existe (le vendeur a bien encaissé) mais elle n'apparaît pas dans `/ventes` ni dans le Sheet.

### Causes possibles
- Bot Discord crashé / déconnecté
- Embed FaabHook avec format inhabituel non géré par le parser
- Erreur côté `botIngest` Cloud Function (logs à consulter)

### Solutions
1. Vérifier l'état du bot (logs)
2. Le vendeur peut **déclarer manuellement** la vente via `/employee` → Bouton "📝 Déclarer une vente"
3. Si récurrent : analyser l'embed problématique sur Discord, adapter le parser concerné

---

## 📦 Stock négatif Discord bot

### Symptôme
Le bot Discord cause un stock négatif pour un produit (ex: `cola-zero`).

### Cause
Le handler `inventory-remove` du parser manque ou ne mappe pas correctement l'item FiveM vers `produitId`.

### Workaround
Ajustement manuel via `/admin` → Stocks → corriger la valeur.

### Solution durable
Vérifier le mapping `/stocks/{produitId}.fivemItemId` + `alias[]` et ajouter l'item manquant.

Mémoire : `projet_bug_stock_negatif_bot`.

---

## 🔁 Idempotence des clôtures

### Bonne pratique
Toutes les fonctions de clôture (snapshot paies, snapshot Sheet, écriture `/semaines`) sont **idempotentes** : relancer 2x = même résultat, pas de doublon.

Pour vérifier : tester en faisant 2 fois le clic 🔒 manuel sur la même semaine. Aucun crash, données identiques.

### Si tu casses l'idempotence
- Onglet Sheet `Semaine N` créé 2 fois (doublon)
- Snapshots `/paiesEstimees` avec timestamps différents (à chaque clic)
- Statut `/semaines` qui rebascule à `cloturee-partielle`

→ Toujours utiliser des IDs stables (`{weekKey}_{userId}` pour snapshots, `{weekKey}` pour semaine) + check `if exists, skip ou update merge`.

---

## 🚨 Node 20 deprecation Google (2026-10-30)

### Symptôme à venir
Après le 30/10/2026, les déploiements Cloud Functions sur Node 20 seront refusés.

### Solution
Migrer vers Node 22 :
1. `firebase/functions/package.json` → `"engines": { "node": "22" }`
2. Mettre à jour `firebase-functions` à v6+ (breaking changes possibles)
3. Tester en local avec Node 22
4. Redéployer

Mémoire : `projet_dette_technique_runtime`.

---

## 🔍 Comment debug un endpoint Cloud Function

```bash
# Logs en temps réel
firebase functions:log --only <function-name>

# Logs historiques (dernières 24h)
firebase functions:log --only <function-name> --limit 50

# Tester un endpoint
curl -X POST https://europe-west1-<projet>.cloudfunctions.net/<function> \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'

# Récupérer un ID token Firebase Auth pour test (depuis console browser)
# > firebase.auth().currentUser.getIdToken().then(t => console.log(t))
```

---

## 🆘 Restaurer Firestore depuis backup

Si tu as un `backup-XXXX.json` :
```bash
# Pas de script natif fourni — à coder ad-hoc selon le besoin
# Pattern : lire le JSON + batch.set() chaque doc
```

À implémenter si nécessaire. En attendant, le backup sert au moins comme référence consultable.

---

## 💡 Ressources de debug rapides

- **Firebase Console** → Firestore → Data : inspect direct des collections
- **Firebase Console** → Functions → Logs : erreurs runtime
- **Discord Developer Portal** → bot → onglet Bot : status connexion
- **Google Cloud Console** → Logging : logs détaillés Functions + Sheets API
- **GitHub Pages** → Settings → Pages → "Visit site" : URL prod
