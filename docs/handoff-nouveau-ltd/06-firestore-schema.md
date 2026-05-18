# 06 — Schéma Firestore complet

> Toutes les collections + champs documentés. Index composites listés en bas. Règles ACL dans `firebase/firestore.rules`.

---

## `/users/{uid}`

Profil employé. UID = Firebase Auth UID.

```js
{
  // Identité
  email: 'blake.mars@ltd-sandy-shores.com',
  prenom: 'Blake',
  nom: 'MARS',                              // toujours en MAJUSCULES
  idDiscord: '999759053381185596',          // string (pas Number, IDs trop longs)
  idPerso: '12345',                         // matricule perso RP (optionnel)

  // Rôle & statut
  role: 'patron',                           // cf liste ci-dessous
  roleReel: 'patron',                       // pour mode "Voir comme..." (sinon = role)
  statut: 'actif',                          // 'actif' | 'suspendu'
  actif: true,                              // bool dérivé (legacy + courant)
  compteEnFinance: true,                    // si true, compte dans masse salariale

  // RP
  dateEntree: '2026-04-15',                 // string yyyy-MM-dd
  salaireDecide: 20000,                     // optionnel, montant fixe décidé par patron

  // Tech
  createdAt: Timestamp,
  updatedAt: Timestamp,
  derniereConnexion: Timestamp
}
```

**Rôles possibles** :
- `patron`, `co-patron`, `drh`
- `responsable-vente`, `responsable-pompiste`
- `vendeur-novice`, `vendeur-intermediaire`, `vendeur-experimente`
- `pompiste-novice`, `pompiste-intermediaire`, `pompiste-experimente`
- `admin-technique`

---

## `/ventes/{id}`

Ventes au comptoir.

```js
{
  timestamp: Timestamp,                      // moment de la vente
  source: 'discord' | 'manuelle' | 'rattrapage-factures',
  factureId: '1923212',                     // numéro IG (ou 'M20260518-0001' si manuelle)

  // Vendeur
  vendeurDiscord: '393106898599018518',     // ID Discord
  vendeurNom: 'Jeorge Stevenson',
  vendeurUserId: '<firebaseUid>',           // optionnel, si matché user site

  // Client (souvent vide pour ventes comptoir)
  clientNom: 'Yuri Lacerda',
  client: 'Yuri Lacerda',                   // legacy alias

  // Montants
  montant: 208,                             // total vente $ (Number)
  benefice: 50,                             // CA - coût produits (calcul site uniquement)
  paiement: 'especes' | 'carte',

  // Détail (présent uniquement si déclaration manuelle)
  produits: [
    { produitId: 'cola', nom: 'Cola', quantite: 12, prixUnit: 15, pourPro: false }
  ],
  raison: 'bonbon 20 cola 12',              // raison libre / commentaire

  // Flags spéciaux
  cachee: false,                            // true si dédupliquée (doublon bot/manuel)
  annulee: false,                           // true si supprimée IG (F1 menu)

  // Trace bot
  factureBotRef: '1923212',                 // si vente manuelle qui matche une discord

  // Historique modifications (sous-collection optionnelle)
  // /ventes/{id}/historique/{eventId}
}
```

---

## `/depenses/{id}`

Dépenses du LTD (achats fournisseurs, frais, loyer, etc.).

```js
{
  timestamp: Timestamp,
  raison: 'Achat boutique N°264',
  montant: 250,

  // Classification
  type: 'matieres-premieres' | 'frais-vehicule' | 'achat-vehicule' | 'non-deductible' | 'paie' | ...,
  deductible: true | false,                 // selon TTE Art. 4-1.4

  // Fournisseur (mapping config)
  fournisseur: 'Yootool',                   // legacy
  fournisseurLabel: 'Yootool',              // display
  fournisseurPatternId: 'yootool-263',      // ref dans /config/global.fournisseurs

  // Validation patron
  valideParPatron: true,                    // si patron a confirmé classification (vs suggestion auto)
  raisonClassification: 'Fournisseur matières premières (Art. 4-2.9) — revente clients',

  // Trace
  utilisateur: 'Blake MARS',                // qui a saisi (string ou Discord ID)
  soldeAvant: 50000,                        // solde compte avant
  soldeApres: 49750,                        // après
  noteAudit: 'optionnel'
}
```

---

## `/paies/{id}`

Paies versées par le patron.

```js
{
  timestamp: Timestamp,                      // moment du paiement (en jeu)

  // Payeur (toujours le patron RP)
  payeurDiscord: '999759053381185596',
  payeurNom: 'Blake Mars (<@999759053381185596>)',  // souvent pollué par le bot, à nettoyer

  // Bénéficiaire
  beneficiaireDiscord: '393106898599018518',
  beneficiaireNom: 'Jeorge Stevenson (<@393106898599018518>)',
  beneficiaireId: '<firebaseUid>',          // optionnel

  // Montant
  montant: 14000,

  // Rattachement semaine
  periode: 'S20 2026',                      // optionnel (rempli si saisie manuelle)
  weekKeyAttribuee: '2026-05-11',           // posé à la clôture pour rattacher à la bonne semaine
  cachee: false                             // mêmes flags que ventes
}
```

---

## `/semaines/{weekKey}`

Snapshot d'une semaine clôturée. `weekKey = 'YYYY-MM-DD'` du lundi.

```js
{
  numero: '2026-05-11',                     // = weekKey
  dateDebut: Timestamp,                     // lun 00h00 Paris (= sam 22h UTC en CEST)
  dateFin: Timestamp,                       // dim 23h59:59.999 Paris

  // Calculé étape 1 (cron lundi 00h00 OU manuelle)
  ca: 266174,
  caProduits: 155664,
  caCarburant: 110510,
  beneficeBrut: 67784.5,                    // CA - coût produits
  depenses: 961965,                         // depensesTotales (legacy alias)
  depensesTotales: 961965,
  chargesDeductibles: 922315,
  nbVentes: 1290,
  nbDepenses: 116,

  // Calculé étape 2 (cron mardi 21h05 OU clôture manuelle)
  masseSalariale: 97458,
  beneficeNet: -793249,                     // CA - depenses - masseSalariale
  primeHebdo: 5000,                         // Art. 4-1.10 (potentielle)
  primeMensuelle: 0,                        // Art. 4-1.11

  // Statut
  statut: 'cloturee-partielle' | 'cloturee-manuelle' | 'cloturee',
  cloturePar: '<uid>',                      // si manuelle
  cloturParNom: 'Blake MARS',
  dateClotureManuelle: Timestamp,
  noteCloture: 'RAS',

  // Fenêtre paie (utilisée pour ramasser les paies de la semaine)
  fenetrePaieDebut: Timestamp,              // lun N+1 00h00 Paris
  fenetrePaieFin: Timestamp,                // mar N+1 21h00 Paris OU moment du clic 🔒
}
```

---

## `/paiesEstimees/{weekKey}_{userId}`

Snapshot des estimations de paie à la clôture (Option B v1.6.0+).

```js
{
  // Identité
  userId: '<firebaseUid>',
  weekKey: '2026-05-11',
  role: 'vendeur-intermediaire',
  prenom: 'Jeorge',
  nom: 'STEVENSON',

  // Estimation TTE (figée à la clôture)
  montantEstime: 9331,
  ca: 31100,                                // total ventes vendeur (toutes catégories)
  caParticulier: 31100,                     // ventes particuliers (commissionnable)
  bidons: 0,                                // si pompiste
  caoutchoucs: 0,                           // si pompiste

  // Versement (mis à jour via marquerPaieVersee)
  paye: false | true,
  datePaiement: null | Timestamp,           // serverTimestamp() quand coché
  paieMatcheeId: null | '<paieDocId>',      // ref vers /paies/{id} si match
  paieMatcheeMontant: null | Number,        // montant réel versé (pour audit écart)

  // Trace
  majPar: '<uid>',
  majParNom: 'Blake MARS',
  dateMaj: Timestamp,
  createdAt: Timestamp                      // posé au moment de la création snapshot
}
```

**ID composite** : `{weekKey}_{userId}` garantit l'unicité et l'idempotence (re-clôture = même ID).

---

## `/banqueLtd/{id}`

Mouvements du compte bancaire LTD (entrées xbankaccount + sorties si tracées).

```js
{
  timestamp: Timestamp,
  type: 'add' | 'remove',                   // entrée / sortie
  montant: 1000,
  soldeAvant: 50000,
  soldeApres: 51000,
  raison: 'Vente carburant station Sandy',

  // Tagging optionnel
  categorieEntree: 'subvention' | null,     // si subvention IRS

  // Source
  source: 'xbankaccount' | 'manuel',
  utilisateur: 'Blake MARS'
}
```

---

## `/redistributions/{id}`

Ventes carburant agrégées par station (capture FaabHook spécifique essence).

```js
{
  timestamp: Timestamp,
  station: 'Sandy Shores Gaz',
  pompiste: 'Gordy CHAPMAN',                // optionnel
  pompeIdx: 0,
  litres: 500,
  prixUnit: 5,
  montant: 2500
}
```

---

## `/stations/{id}`

Stations-essence.

```js
{
  nom: 'Sandy Shores Gaz',
  position: { x: 1234, y: 5678 },           // coords FiveM
  pompes: [
    { essence: 'Essence', stock: 5000, prix: 5 },
    { essence: 'Gasoil', stock: 3000, prix: 6 },
    ...
  ],
  stocksMatieres: {
    bidons: 1500,
    caoutchoucs: 200
  },
  seuilAlerteStock: 1000,
  actif: true,
  responsableUserId: '<uid>'
}

// Sous-collections
/stations/{id}/ravitaillements/{id}      // { pompiste, bidons, station, pompeIdx, timestamp }
/stations/{id}/corrections/{id}          // { ancienStock, nouveauStock, raison, timestamp, par }
```

---

## `/stocks/{produitId}`

Catalogue épicerie + stocks.

```js
{
  produitId: 'cola',                        // = doc ID, slug
  nom: 'Cola',
  categorie: 'boisson',                     // 'nourriture' | 'boisson' | 'hygiene' | 'materiel' | 'matieres-premieres'
  prix: 15,                                 // prix unitaire de vente $
  prixAchat: 8,                             // coût d'achat (pour calcul bénéfice)
  stockActuel: 234,
  seuilAlerte: 50,                          // déclenche badge orange
  pourPro: false,                           // si true, vente non commissionnée
  vendable: true,                           // si false, c'est un intrant (matières premières)
  fivemItemId: 'cola_zero',                 // mapping vers ID item FiveM
  alias: ['coca', 'coca-cola'],             // alternatives pour parser bot
  noteTech: '...'
}
```

---

## `/alertes/{id}`

Alertes UI + notifications.

```js
{
  timestamp: Timestamp,
  type: 'stock-faible' | 'sortie-expiree' | 'fraude-suspecte' | 'engagement-echeance' | ...,
  severite: 'info' | 'warning' | 'critique',
  message: 'Stock cola faible (10 restants)',
  resolue: false,                           // marquée traitée par direction
  lu: false,                                // marquée vue (cache du badge mais reste dropdown)
  refType: 'stock' | 'vente' | 'engagement' | ...,
  refId: '<docId>'
}
```

---

## `/engagements/{id}`

Dettes / subventions à rembourser.

```js
{
  beneficiaire: 'Governor of San Andreas (IRS)',
  signataire: 'Abraham THORPE',
  objet: 'Subvention essence W19',
  type: 'subvention' | 'pret' | 'amende' | ...,
  montantInitial: 300000,
  montantRembourse: 0,
  montantRestant: 300000,
  dateContrat: Timestamp,
  dateEcheance: Timestamp,                  // ex: 4 semaines après contrat
  statut: 'actif' | 'rembourse' | 'annule',
  remboursements: [                          // historique versements partiels
    { date: Timestamp, montant: 50000, note: '...' }
  ],
  noteAudit: 'Contrat IRS Abraham THORPE, dette essence carte entreprise'
}
```

---

## `/config/{docId}`

Config globale (singleton `/config/global`).

```js
// /config/global
{
  // Fournisseurs / déductibilité (mapping pour auto-classification)
  fournisseurs: [
    {
      id: 'yootool-263',
      label: 'Yootool',
      matchType: 'boutique',                // 'boutique' | 'compte-cible' | 'raison-contient'
      matchValue: 'N°263',
      categorie: 'matieres-premieres',
      deductible: true,
      noteAudit: 'Fournisseur matières premières TTE Art. 4-2.9'
    },
    ...
  ],

  // Quotas pompiste hebdo
  quotaBidons: 1700,
  quotaCaoutchoucs: 800,

  // Pompes FiveM mapping (pour parser bot)
  fivemPompesMap: {
    'sandy_shores_gas_pump_1': { station: 'Sandy Shores Gaz', pompeIdx: 0, essence: 'Essence' },
    ...
  },

  // Prix carburant par défaut
  prixCarburant: {
    'Essence': 5,
    'Gasoil': 6,
    'Premium': 8
  }
}
```

---

## `/quotasPompiste/{weekKey}_{userId}`

Quotas hebdo d'un pompiste (snapshot par semaine pour historique).

```js
{
  userId: '<uid>',
  weekKey: '2026-05-11',
  bidons: 1450,
  caoutchoucs: 600,
  quotaBidons: 1700,
  quotaCaoutchoucs: 800,
  score: 86,                                // % atteinte
  updatedAt: Timestamp
}
```

---

## 🔐 Règles Firestore (extrait)

Fichier : `firebase/firestore.rules`

Patterns clés :
- `/users/{uid}` : read self + direction/DRH/admin. Write direction/admin only.
- `/ventes`, `/depenses` : read direction + DRH. Write via Cloud Functions uniquement (botIngest, declarerVente, etc.).
- `/paies` : read direction + DRH + bénéficiaire (self).
- `/paiesEstimees` : read direction + DRH. **Write = false** (passe par Cloud Function `marquerPaieVersee`).
- `/semaines` : read all auth. Write via Cloud Functions only.
- `/stations`, `/stocks` : read all auth. Write direction + responsables.
- `/config/global` : read all auth. Write direction + admin only.

---

## 📐 Index composites Firestore

Fichier : `firebase/firestore.indexes.json`

Indexes typiques à créer (déployés via `firebase deploy --only firestore:indexes`) :

```json
{
  "indexes": [
    {
      "collectionGroup": "ventes",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "timestamp", "order": "DESCENDING" },
        { "fieldPath": "vendeurDiscord", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "paies",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "beneficiaireId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "paiesEstimees",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "weekKey", "order": "ASCENDING" },
        { "fieldPath": "userId", "order": "ASCENDING" }
      ]
    }
    // + autres selon les queries qu'on ajoute
  ]
}
```

⚠ Si une query échoue avec "needs index" → Firestore propose un lien direct pour créer l'index. Cliquer + attendre 1-2 min.

---

## 💾 Sauvegarde

Le script `firebase/functions/scripts/backup-complet.js` exporte toutes les collections dans des JSON locaux pour backup. À lancer périodiquement :

```bash
cd firebase/functions
node scripts/backup-complet.js
# → crée backup-2026-05-18-HH-MM.json à la racine du repo (gitignored)
```
