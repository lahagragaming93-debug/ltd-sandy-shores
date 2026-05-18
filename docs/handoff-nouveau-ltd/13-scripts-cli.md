# 13 — Scripts CLI conservés (15 outils)

> Après nettoyage v1.7.0, voici les scripts utiles encore présents dans `firebase/functions/scripts/`. Tous lancés via `node scripts/<nom>.js` depuis le dossier `firebase/functions/`.

---

## 🌱 Bootstrap (à lancer une fois lors du setup d'un nouveau LTD)

### `init-stations.js`
Crée les 8 stations-essence dans `/stations` avec leurs pompes, prix par défaut, stocks initiaux.

```bash
node scripts/init-stations.js
```

⚠ **À éditer avant lancement** : liste des stations + coords FiveM + prix carburant.

---

### `init-stocks.js`
Crée le catalogue produits dans `/stocks` (cola, bonbons, etc.) avec prix, seuils, flag `pourPro`.

```bash
node scripts/init-stocks.js
```

⚠ **À éditer** : le catalogue de produits du nouveau LTD si différent.

---

### `init-fournisseurs-mapping.js`
Crée le mapping fournisseurs → déductibilité dans `/config/global.fournisseurs`.

```bash
node scripts/init-fournisseurs-mapping.js
```

⚠ **À éditer** : les patterns (boutique N°, compte cible, raison) selon les fournisseurs RP du nouveau LTD.

---

### `init-engagements.js`
Crée des engagements de remboursement initiaux (subvention IRS, dettes de démarrage).

```bash
node scripts/init-engagements.js
```

⚠ **Optionnel** : skip si pas de dette initiale.

---

## 🔧 Maintenance régulière

### `format-sheet.js`
Applique le formatage standard (couleurs, bordures, money format, datetime, zebra) aux onglets `Ventes` et `Dépenses` du Sheet Compta.

```bash
node scripts/format-sheet.js
```

À relancer si :
- Premier setup du Sheet
- Modification du formatage souhaité dans le script
- Onglet recréé manuellement (format perdu)

---

### `force-refresh-sheet.js`
Casse le cache IMPORTDATA (~1h) des onglets Ventes/Dépenses du Sheet en modifiant le param `&_t=<timestamp>` dans la formule.

```bash
node scripts/force-refresh-sheet.js
```

Utile quand : tu viens de modifier des données Firestore et veux voir le résultat immédiatement dans le Sheet.

---

### `force-refresh-dashboard.js`
Appelle l'endpoint `refreshDashboardNow` en local pour régénérer le Dashboard du Sheet.

```bash
node scripts/force-refresh-dashboard.js
```

Alternative au bouton "🔄 Rafraîchir doc compta" du site `/comptabilite`.

---

### `refaire-dashboard-pro.js`
Régénère complètement le Dashboard du Sheet en local (utile pour debug ou si le cron est cassé).

```bash
node scripts/refaire-dashboard-pro.js
```

Plus radical que `force-refresh-dashboard.js` car appelle directement la lib `dashboard-core.mjs` sans passer par l'endpoint HTTP.

---

## 💾 Sauvegarde / consultation

### `backup-complet.js`
Exporte toutes les collections Firestore dans un fichier JSON local (gitignored).

```bash
node scripts/backup-complet.js
# → crée backup-2026-05-18-HH-MM.json
```

**À lancer périodiquement** (mensuel recommandé) pour disposer d'un snapshot historique.

---

### `list-users.js`
Liste tous les users de Firestore avec leur rôle, statut, email.

```bash
node scripts/list-users.js
```

Read-only. Utile pour audit RH rapide en ligne de commande.

---

### `list-ventes-intervalle.js`
Liste les ventes sur un intervalle de dates spécifié dans le script.

```bash
# Éditer la constante DEBUT/FIN en haut du script puis :
node scripts/list-ventes-intervalle.js
```

Read-only. Utile pour debug "où sont passées les ventes de telle date".

---

### `list-ventes-vendeur.js`
Liste les ventes d'un vendeur spécifique (par ID Discord ou Firebase UID).

```bash
# Éditer la constante CIBLE puis :
node scripts/list-ventes-vendeur.js
```

Read-only. Utile pour debug commission vendeur, ou vérifier qu'un vendeur a bien déclaré ses ventes.

---

### `list-fournisseurs-config.js`
Affiche le mapping fournisseurs actuel depuis `/config/global.fournisseurs`.

```bash
node scripts/list-fournisseurs-config.js
```

Read-only. Utile pour vérifier ce qui est déjà mappé avant d'ajouter de nouveaux patterns.

---

### `list-produits-pour-parser.js`
Génère une liste de produits formatée pour le parser du bot Discord (mapping nom FiveM → produitId site).

```bash
node scripts/list-produits-pour-parser.js > ../../discord-bot/parsers/items-catalogue.json
```

À relancer après chaque modif du catalogue produits.

---

## 🔄 Rattrapage / resync

### `resync-stocks.js`
Resync les stocks d'épicerie depuis les logs FiveM (utile si trou dans la déclaration via le bot, ou si on a changé les seuils).

```bash
node scripts/resync-stocks.js
```

⚠ **Lourd** : lit beaucoup de docs Firestore. À utiliser en cas réel de désynchro.

---

## 🚫 Scripts supprimés en v1.7.0

Pour info, les scripts suivants ont été supprimés (ponctuels, déjà appliqués, ou debug terminé) :

- `add-filters-sheet.js`
- `ajouter-patterns-factures.js`
- `backfill-benefice-direction.js`
- `backfill-classification-depenses.js`
- `backfill-fournisseur-label.js`
- `backfill-snapshot-paies-w18.mjs`
- `backfill-snapshot-sheet-semaine-w20.mjs`
- `backfill-tag-paies-w18.js`
- `check-cloture-w18.js`
- `check-depenses-classees.js`
- `check-produit-fertilizer.js`
- `check-teodomiro.js`
- `debloquer-teodomiro.js`
- `debug-banque-kpis.js`
- `debug-paies-f1.js`
- `debug-sheet-content.js`
- `diag-compta-semaine.js`
- `diag-verif-final.js`
- `fix-paies-deductibles.js`
- `fix-patterns-hdm-dynasty.js`
- `inspect-fraude-annulation.js`
- `maj-produits-alias.js`
- `maj-yootool-multi-comptoirs.js`
- `marquer-subvention.js`
- `recalc-semaine-complet.js`
- `recalc-semaine-masse.js`
- `reset-password-direct.js` (préférer la fonction `adminResetPassword` via `/admin`)
- `set-webhook-antivol.js`

→ Si tu en as besoin pour le nouveau LTD, ils sont récupérables via l'historique git (`git log -- firebase/functions/scripts/<nom>.js`).

---

## 📝 Template pour créer un nouveau script

Si tu crées un nouveau script dans `firebase/functions/scripts/` (backfill ad-hoc, debug, etc.), utilise ce template :

```js
// scripts/mon-script.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(resolve(__dirname, '../../serviceAccountKey.json'), 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

// === Ton code ici ===

console.log('Done.');
process.exit(0);
```

Pour Sheets API en plus :
```js
import { google } from 'googleapis';
const auth = new google.auth.GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = '<TON SHEET_ID>';
```
