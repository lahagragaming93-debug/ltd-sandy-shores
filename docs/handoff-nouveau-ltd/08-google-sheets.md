# 08 — Google Sheets (doc compta IRS)

> Architecture du Sheet partagé au contrôleur IRS RP. Comprend Dashboard généré côté serveur + onglets live (IMPORTDATA) + onglets snapshots figés par semaine.

---

## 🎯 Rôle du Sheet

Le contrôleur IRS du serveur RP veut voir un **vrai Google Sheet officiel** partageable, pas une interface web custom. Le Sheet est :

- **Hébergé sur Google Drive** du patron RP (ou compte dédié)
- **Partagé en lecture** au contrôleur RP (lien direct ou email)
- **Partagé en édition** au service account Firebase (pour que les Functions puissent écrire)
- **Toujours à jour** (refresh manuel du Dashboard + cron keep-alive)
- **Auditable historiquement** (un onglet figé par semaine clôturée)

---

## 📑 Liste des onglets (v1.7.0)

### 1. `📊 Dashboard` — Vue d'ensemble semaine en cours

- Généré **côté serveur** via `firebase/functions/lib/dashboard-core.mjs`
- Rafraîchi :
  - Manuellement via bouton "🔄 Rafraîchir doc compta" sur `/comptabilite` (appelle `refreshDashboardNow`)
  - Automatiquement par cron `dashboardKeepAlive` (every minute, check cellule A1 et régénère si vide)
  - À chaque clôture manuelle (le code appelle `regenererDashboard` à la fin de `cloturerSemaine`)

### 2. `Ventes Semaine N (jj-jj mois aaaa)` — Live semaine en cours

- Onglet **live** via `=IMPORTDATA("...?type=ventes&token=...&_t=<timestamp>")`
- Le endpoint `comptaExport?type=ventes` retourne **uniquement les ventes Discord (`source=='discord'`) non annulées de la semaine en cours**
- Cache IMPORTDATA Google Sheets : ~1h. Cassable via le script `force-refresh-sheet.js` ou bouton refresh UI.
- Renommé automatiquement chaque lundi 00h par le cron `clotureHebdo` → `Ventes Semaine 21 (18-24 mai 2026)`

### 3. `Dépenses Semaine N (jj-jj mois aaaa)` — Live semaine en cours

- Idem `Ventes` mais pour les dépenses (`type !== 'paie'` semaine en cours)
- Renommé chaque lundi 00h en parallèle

### 4. `Semaine N (jj-jj mois aaaa)` ×N — Snapshots historiques (audit IRS)

- Un onglet **par semaine clôturée**, créé au moment de la clôture par `snapshotSheetSemaine`
- **Figé** : ne change plus après création, même si on modifie les collections Firestore
- Contenu :
  - Bandeau titre rouge sang + sous-titre `S20 2026 — du 11/05 au 17/05`
  - Horodatage `Snapshot figé le lundi 18 mai 2026 à 02h49`
  - 3 KPI cards : CA TOTAL / CHARGES DÉDUCTIBLES / BÉNÉFICE NET
  - Section VENTES (Discord uniquement, numéros IG)
  - Section DÉPENSES
  - Section PAIES (avec colonne **ID Discord bénéf.** pour conserver matricule même si compte supprimé)
  - Footer "Snapshot figé pour audit IRS"
- TabColor rouge sang pour distinguer visuellement des onglets live

### Onglets supprimés en v1.7.0
- ~~`resumé`~~ — info dans HISTORIQUE des semaines du Dashboard + onglets snapshots
- ~~`Paies`~~ — info dans section Paies de chaque onglet snapshot

---

## 🔧 Comment c'est généré

### Pour `📊 Dashboard` et `Semaine N` (snapshots)

Les deux utilisent l'API **Google Sheets** (`googleapis` package, scope `spreadsheets`) :

1. **Lecture Firestore** : récupère ventes, dépenses, paies, semaines, engagements, subventions, banque
2. **Construction `rows[]`** : tableau 2D (rows × cols 0-8) avec valeurs string/number
3. **Sheets API `values.update`** : USER_ENTERED pour que Sheets parse les dates et formules
4. **Sheets API `batchUpdate`** : applique mise en forme (couleurs, fusions, padding, fontes, bordures, hauteurs/largeurs colonnes) en plusieurs batches de 30 requêtes

### Pour `Ventes` / `Dépenses` (live)

Les onglets contiennent **une seule cellule A1** avec une formule :
```
=IMPORTDATA("https://europe-west1-<projet>.cloudfunctions.net/comptaExport?type=ventes&token=<COMPTA_TOKEN>&_t=1779061637837")
```

Le param `&_t=<timestamp>` sert au cache-bust. Le script `lib/refresh-importdata.mjs` modifie ce timestamp pour forcer Google Sheets à refetch.

L'endpoint `comptaExport` retourne du CSV UTF-8 BOM-prefixed.

---

## 🎨 Palette couleurs Sheet

Constante `C` partagée dans `dashboard-core.mjs` et `snapshot-sheet-semaine.mjs` :

```js
const C = {
  blood:  { red: 0.545, green: 0,     blue: 0     }, // #8B0000 rouge sang
  blood2: { red: 0.70,  green: 0.10,  blue: 0.10  }, // rouge plus clair
  bone:   { red: 0.961, green: 0.941, blue: 0.91  }, // #F5F0E8 ivoire
  bone2:  { red: 0.98,  green: 0.97,  blue: 0.95  }, // ivoire clair
  gold:   { red: 0.788, green: 0.663, blue: 0.380 }, // #c9a961 doré
  gold2:  { red: 0.92,  green: 0.85,  blue: 0.60  }, // doré clair
  green:  { red: 0.29,  green: 0.49,  blue: 0.18  }, // #4a7c2e vert sage
  greenL: { red: 0.85,  green: 0.95,  blue: 0.80  }, // vert clair
  orange: { red: 0.79,  green: 0.50,  blue: 0.10  }, // #c97f1a orange brûlé
  orangeL:{ red: 1.00,  green: 0.93,  blue: 0.78  }, // orange pâle
  blue:   { red: 0.29,  green: 0.42,  blue: 0.54  }, // #4a6b8a bleu acier
  blueL:  { red: 0.85,  green: 0.90,  blue: 0.96  }, // bleu pâle
  red:    { red: 0.79,  green: 0.20,  blue: 0.20  },
  redL:   { red: 1.00,  green: 0.85,  blue: 0.82  },
  white:  { red: 1, green: 1, blue: 1 },
  black:  { red: 0, green: 0, blue: 0 },
  gray:   { red: 0.45, green: 0.45, blue: 0.45 },
  grayL:  { red: 0.92, green: 0.92, blue: 0.92 }
};
```

**Convention** :
- Bandeaux titres : `C.blood` (fond) + `C.bone` (texte)
- Sous-titres : `C.blood2` italic
- KPI cards : couleur fond pâle (`C.greenL`, `C.redL`, `C.bone2`, ...) + border-color foncée (`C.green`, `C.red`, `C.gold`, ...)
- Headers tables : `C.grayL` + bold
- Footer : `C.grayL` + italic petit

---

## 🔄 Refresh & cache

### Cache IMPORTDATA (Ventes / Dépenses)

Google Sheets cache les résultats de `=IMPORTDATA(url)` pendant **~1 heure**. Pour casser :

**Option 1** : bouton "🔄 Rafraîchir doc compta" sur `/comptabilite` → appelle `refreshDashboardNow` qui :
1. Régénère Dashboard
2. Pour chaque cellule contenant `=IMPORTDATA`, met à jour le param `&_t=<now>` dans l'URL → force Sheets à refetch

**Option 2** : script local
```bash
cd firebase/functions
node scripts/force-refresh-sheet.js
```

**Option 3** : éditer/restaurer manuellement une cellule IMPORTDATA (chiant)

### Cache Dashboard

Le Dashboard est généré côté serveur, pas cached. Mais le **rendu Sheet** peut nécessiter un F5 navigateur si le user a la page ouverte.

Le cron `dashboardKeepAlive` (every minute) check la cellule A1 du Dashboard. Si manquante / corrompue → régénération auto. Ça évite le Dashboard "vide" après un crash ou modif accidentelle.

---

## 🔐 Auth Google Sheets API

### Service account

1. Google Cloud Console → IAM → Service Accounts → Create
2. Donner un nom (ex: `dashboard-writer`)
3. Pas de rôles IAM nécessaires (juste l'auth)
4. Générer une clé JSON, télécharger
5. **Partager le Sheet en édition** avec l'email du service account (ex: `dashboard-writer@<projet>.iam.gserviceaccount.com`)

### Stockage de la clé

- **Local dev** : `firebase/serviceAccountKey.json` (gitignored)
- **Cloud Functions** : secret Firebase
  ```bash
  firebase functions:secrets:set DASHBOARD_SA_KEY --data-file ./serviceAccountKey.json
  ```
- Les Functions qui font appel à Sheets API doivent déclarer `secrets: [DASHBOARD_SA_KEY]`

### Helper `getSheetsClient()`

Dans `index.js` :
```js
function getSheetsClient() {
  const sa = JSON.parse(DASHBOARD_SA_KEY.value());
  const auth = new google.auth.GoogleAuth({
    credentials: sa,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({ version: 'v4', auth });
}
```

---

## 🆔 SHEET_ID — comment le retrouver

L'URL du Sheet est de la forme :
```
https://docs.google.com/spreadsheets/d/<SHEET_ID>/edit
```

Pour Sandy Shores : `SHEET_ID = '1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY'`

Pour un nouveau LTD : récupérer l'ID depuis l'URL du nouveau Sheet, puis remplacer dans :
- `firebase/functions/index.js` → constante `SHEET_ID_COMPTA`
- `firebase/functions/lib/dashboard-core.mjs` → constante `SHEET_ID`
- `firebase/functions/lib/snapshot-sheet-semaine.mjs` → constante `SHEET_ID`
- `firebase/functions/lib/refresh-importdata.mjs` → constante `SHEET_ID`

Commandes pour trouver toutes les occurrences :
```bash
grep -rn "1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY" firebase/
grep -rn "SHEET_ID" firebase/functions/
```

---

## 📐 Format CSV (endpoint `comptaExport`)

### `?type=ventes`

```csv
Date,N° Facture IG,Vendeur,Client,Montant,Paiement,Raison
2026-05-17 23:22:31,1923212,Jeorge Stevenson,Yuri Lacerda,208,especes,bonbon 20 cola 12
...
```

### `?type=depenses`

```csv
Date,Raison,Montant,Type,Déductible,Fournisseur,Validé par patron,Justification,Utilisateur
2026-05-14 17:52:09,Achat boutique N°264,250,matieres-premieres,oui,Yootool,non,Fournisseur matières premières (Art. 4-2.9) — revente clients,Blake MARS
...
```

### `?type=banque`

```csv
Date,Type,Montant,Solde avant,Solde après,Raison,Utilisateur,Source
2026-05-14 17:00:33,Sortie,180,156532,156352,Achat essence,Blake MARS,depense
2026-05-14 16:00:00,Entrée,790000,9000,799000,Subvention IRS,Système,xbankaccount
...
```

⚠ Format date `yyyy-MM-dd HH:mm:ss` est reconnu par Google Sheets comme un vrai datetime → numberFormat date applicable + tri/filtres intelligents.

---

## 🎨 Format-sheet.js — Formatage des onglets live

Le script `firebase/functions/scripts/format-sheet.js` (~440 LOC) :

- Détecte tous les onglets matching patterns (`/^Ventes( |$)/`, `/^D[ée]penses( |$)/`)
- Applique : header rouge, wrap text, autoResize cols+rows, freeze first row, bordures
- Money format `# ##0 "$"` sur colonnes Montant
- Date format `dd/MM/yyyy HH:mm:ss` sur colonnes Date
- Couleurs conditionnelles `Déductible` (vert oui / rouge non)
- Zebra ivoire / blanc (rows alternantes)
- Largeurs adaptées (Raison 220px, Justification 320px, etc.)

À relancer après chaque modif du formatage souhaité :
```bash
cd firebase/functions
node scripts/format-sheet.js
```

---

## 🐛 Pièges connus Sheets

- **`s.numero` weekKey "2026-05-11"** est parsé en date par Sheets → affiche `46153` (serial Excel). Solution : préfixer avec `weekIsoLabel()` côté CSV pour obtenir `S20 2026`.
- **`dateFin` Firestore Timestamp** stocké `2026-05-17T22:00:00.998Z` → converti en Paris donne `18/05 00:00:00.998` → bascule au jour suivant si formaté avec `Intl.DateTimeFormat`. Solution : recalculer le dimanche depuis weekKey (`lundi + 6 jours à midi local`).
- **Cellule A1 corrompue** : si quelqu'un écrit dedans → le cron keep-alive régénère. Mais si la grille a été déplacée, ça peut casser le formatage. Solution : régénérer manuellement via `refaire-dashboard-pro.js`.
- **Onglet supprimé par accident** : Google n'a pas de soft-delete. Pour un onglet snapshot perdu : relancer `snapshotSheetSemaine` via un script ad-hoc. Pour Dashboard : `refaire-dashboard-pro.js`.
- **Onglet existant avec mauvais titre** : si le format du titre change (ex: bug "11-18 mai" au lieu de "11-17 mai") et qu'on régénère, on aura 2 onglets. Toujours supprimer l'ancien avant de relancer.

---

## 🔗 Partage du Sheet au contrôleur IRS RP

Recommandation :
1. Bouton "Partager" en haut à droite du Sheet
2. Ajouter l'email du contrôleur RP en **lecture seule** (Reader)
3. Ou générer un lien "Toute personne avec le lien — Lecture" + envoyer ce lien dans Discord/RP

⚠ Ne JAMAIS partager en édition au contrôleur (risque de pollution accidentelle des données auditées).
