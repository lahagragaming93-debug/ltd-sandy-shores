# 09 — Permissions & ACL

> Matrice complète : rôles × pages × actions. Sources : `public/js/utils/permissions.js` (frontend), `firebase/firestore.rules` (serveur), check inline dans chaque Cloud Function.

---

## 👥 Rôles disponibles

| Rôle (string Firestore) | Label affiché | Description |
|---|---|---|
| `patron` | 👑 Patron | Tous les droits. Le seul qui peut tout faire. |
| `co-patron` | 👑 Co-Patron | Mêmes droits que patron sauf retrait du patron. |
| `drh` | 📋 DRH | RH + lecture compta. Pas de clôture, pas d'admin. |
| `responsable-vente` | 🛒 Responsable Vente | Encadrement vendeurs, gestion stocks épicerie. |
| `responsable-pompiste` | ⛽ Responsable Pompiste | Encadrement pompistes, gestion stations. |
| `vendeur-novice` | 💵 Vendeur (Novice) | Déclare ses ventes, consulte ses paies. |
| `vendeur-intermediaire` | 💵 Vendeur (Inter) | Idem + commission supérieure. |
| `vendeur-experimente` | 💵 Vendeur (Exp) | Idem + commission max. |
| `pompiste-novice` | 🚗 Pompiste (Novice) | Ravitaille, déclare caoutchoucs. |
| `pompiste-intermediaire` | 🚗 Pompiste (Inter) | Idem + quotas plus hauts. |
| `pompiste-experimente` | 🚗 Pompiste (Exp) | Idem. |
| `admin-technique` | 🛠 Admin Technique | Mêmes droits que patron (rôle support pendant la passation). |

---

## 📊 Groupes définis dans `permissions.js`

```js
const DIRECTION = ['patron', 'co-patron'];
const SUPER_ADMINS = ['admin-technique'];
const VENDEURS = ['vendeur-novice', 'vendeur-intermediaire', 'vendeur-experimente'];
const POMPISTES = ['pompiste-novice', 'pompiste-intermediaire', 'pompiste-experimente'];

const LECTURE_COMPTA = [...DIRECTION, 'drh', ...SUPER_ADMINS];
const RH_FULL = [...DIRECTION, 'drh', ...SUPER_ADMINS];
```

---

## 🚪 Matrice Pages × Rôles

| Page | Patron | Co-patron | DRH | Resp. Vente | Resp. Pompiste | Vendeurs | Pompistes | Admin Tech |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `/dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `/comptabilite` (lecture) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/comptabilite` (actions) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/rh` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/ventes` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| `/employee` (sien) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/employee?asUser=` (lecture seule) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/stations` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |
| `/stocks` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ (lecture) | ❌ | ✅ |
| `/banque` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/paies` (mes paies) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/revenus-carburant` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| `/admin` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/guide` (général) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/guide?guide=09-comptabilite` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/guide?guide=10-tte-reference` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `/decouverte-items` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🎯 Matrice Actions critiques × Rôles

| Action | Cloud Function | Patron | Co-patron | DRH | Resp. | Vendeur | Pompiste | Admin Tech |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Cliquer 🔒 Clôturer la semaine | `cloturerSemaine` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cocher Versé ? sur snapshot paie | `marquerPaieVersee` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Reclasser une dépense | `reclasserDepense` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| CRUD engagements (dettes) | `gererEngagement` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Refresh Dashboard Sheet | `refreshDashboardNow` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Reset password user | `adminResetPassword` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Créer / modifier user | (frontend Admin direct) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Modifier une vente (post-saisie) | `modifierVente` | ✅ | ✅ | ✅ | ✅ (vente uniquement) | ❌ | ❌ | ✅ |
| Déclarer une vente | `declarerVente` | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| Ravitailler une station | `pompisteRavitaillerManuel` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Corriger un stock station | `pompisteCorrigerStock` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ (resp. only) | ✅ |
| Déclarer caoutchoucs | `pompisteDeclarerCaoutchoucs` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Voir l'espace d'un autre user (mode debug) | (frontend ?asUser=) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## 🔐 Implémentation

### Côté frontend

Chaque page commence par :
```js
import { requireAuth } from '../auth.js';
const { profile } = await requireAuth('rh');  // pageId = 'rh'
```

`requireAuth(pageId)` lit `PERMISSIONS[pageId]` dans `permissions.js` :
- Si rôle pas dans la liste → redirect `/index` avec message "Accès refusé"
- Sinon retourne `profile` (incl. `role`, `roleReel`, etc.)

Pour conditionner UI (boutons, sections) selon rôle :
```js
import { isDirection, isSuperAdmin } from '../utils/permissions.js';
const editable = isDirection(profile.role) || isSuperAdmin(profile.role);
```

### Côté serveur (Cloud Functions)

Pattern standard pour les endpoints HTTP qui requièrent un rôle :

```js
async function requireDirection(req) {
  const authHeader = req.get('Authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!idToken) throw { status: 401, error: 'Missing Authorization Bearer token' };
  const decoded = await adminAuth.verifyIdToken(idToken);
  const callerSnap = await db.collection('users').doc(decoded.uid).get();
  if (!callerSnap.exists) throw { status: 403, error: 'Caller profile not found' };
  const caller = callerSnap.data();
  const role = caller.role || '';
  if (!['patron', 'co-patron', 'admin-technique'].includes(role)) {
    throw { status: 403, error: 'Direction uniquement' };
  }
  return { uid: decoded.uid, caller };
}
```

Pour des Functions qui autorisent aussi le DRH (ex: `marquerPaieVersee`), check inline :
```js
if (!['patron', 'co-patron', 'drh', 'admin-technique'].includes(role)) {
  return res.status(403).json({ error: 'Direction ou DRH uniquement' });
}
```

### Côté Firestore Rules

```javascript
// Lecture seule pour direction + DRH
match /paiesEstimees/{id} {
  allow read: if request.auth != null && getUserRole() in ['patron', 'co-patron', 'drh', 'admin-technique'];
  allow write: if false; // passe par marquerPaieVersee Cloud Function
}

function getUserRole() {
  return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
}
```

---

## 🐛 Pièges connus

- **`role` vs `roleReel`** : `roleReel` existe pour le mode "Voir le site comme un autre rôle" (super-admin debug). Toujours utiliser `profile.role` pour les checks d'autorisation, sauf si on veut explicitement bypass le mode debug → utiliser `profile.roleReel || profile.role`.
- **DRH peut LIRE compta mais pas ÉCRIRE** : check distinct `comptabilite` vs `comptabilite_edit` côté frontend, et check inline `requireDirection` côté serveur (ne contient pas DRH).
- **Admin-technique = patron** au niveau permissions, mais le rôle existe séparément pour traçabilité ("c'est l'admin tech qui a fait ça, pas le vrai patron RP").
- **`asUser=` mode debug** : seul `roleReel` est checké pour autoriser, pas `role`. Sinon un super-admin qui s'est "vu comme vendeur" perdrait la capacité de débugger.

---

## ➕ Ajouter un nouveau rôle

Si tu dois ajouter un nouveau rôle (ex: `comptable-externe`) :

1. **`public/js/utils/permissions.js`** :
   - Ajouter dans `ROLE_LABELS` : `'comptable-externe': '📊 Comptable externe'`
   - Ajouter dans les groupes pertinents (ex: `LECTURE_COMPTA = [...LECTURE_COMPTA, 'comptable-externe']`)
   - Si applicable, ajouter dans `PLAFOND_SALAIRE`, `compteEnFinance()`, etc.

2. **`firebase/firestore.rules`** :
   - Ajouter dans `getUserRole() in [...]` les collections accessibles
   - Redéployer : `firebase deploy --only firestore:rules`

3. **`firebase/functions/index.js`** :
   - Ajouter dans les check inline des Cloud Functions concernées

4. **`public/guide/00-index.md` et `public/js/pages/guide.js`** :
   - Ajouter dans `GUIDES.acces` si accès restreint
   - Créer un guide markdown dédié si pertinent

5. **`public/js/pages/admin.js`** :
   - Ajouter dans le select rôle de la modale création/édition user

6. **`firebase/functions/lib/paie-calc.mjs`** :
   - Ajouter la logique de calcul salaire pour ce rôle si applicable

---

## 📋 Cheatsheet "qui peut faire quoi" pour copier-coller

```
PATRON / CO-PATRON / ADMIN-TECHNIQUE  : tout
DRH                                    : RH + lecture compta + cocher Versé + créer/modifier users (sauf admin/patron)
RESPONSABLE-VENTE                      : encadrement vendeurs + stocks épicerie + valider ventes
RESPONSABLE-POMPISTE                   : encadrement pompistes + stations + corriger stocks
VENDEURS                               : déclarer ses ventes + voir son espace + consulter stocks
POMPISTES                              : ravitailler + déclarer caoutchoucs + voir son espace
```
