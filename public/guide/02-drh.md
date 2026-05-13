# 📋 Guide DRH — Ressources Humaines

> Tu es le **garant des employés** : leurs heures, leurs paies, la conformité aux plafonds TTE.
> Tu **gères aussi les comptes** (création, modification, suspension, suppression) — sauf le Patron et le Co-Patron, qui restent hors de ton périmètre.
> Tu peux décider les salaires des responsables et de la direction.

---

## 🎯 Tes modules

| Module | Accès | Rôle |
|--------|-------|------|
| 📊 Dashboard | Lecture | Vue d'ensemble (CA, masse, alertes) |
| 🛒 Stocks épicerie | **Lecture + écriture** | Voir, modifier les stocks, **et créer de nouveaux produits** au catalogue |
| ⛽ Stations essence | **Lecture + écriture** | Modifier capacité / prix / stock / N° pompe, ajouter ou supprimer une station |
| 💵 Ventes | Lecture | Voir les factures de la semaine |
| 📋 Comptabilité | Lecture | Voir les comptes (pas modifier) |
| 🧑‍💼 **Ressources humaines** | **Lecture + écriture** | Gérer effectif et salaires décidés |
| ⚙ **Administration** | **Lecture + écriture (sauf direction)** | Créer / modifier / suspendre / supprimer des comptes |
| 👤 Mon espace + 💰 Mes paies | Lecture | Tes infos perso |

> 🔒 Tu n'as pas accès à : **Configuration globale** dans Administration (réservée à la direction).
>
> 🔐 **Périmètre Administration** : tu peux gérer **tous les comptes sauf le Patron et le Co-Patron** (les comptes hors périmètre apparaissent en lecture seule, actions grisées). Tu peux gérer un autre DRH.
>
> 🆕 **2026-05-13** : tu peux désormais modifier les stocks épicerie et essence (alignement avec la direction sur décision du patron).

---

## 🧑‍💼 Le module RH en détail

### Ce que tu vois

#### KPI en haut
| KPI | Signification |
|-----|---------------|
| **Effectif actif** | Nombre d'employés au statut « actif » |
| **Salaires estimés** | Somme des salaires que le système calcule pour la semaine en cours |
| **Salaires versés** | Somme des paies déjà versées via Discord (`#paie`) |
| **Masse salariale %** | Total salaires / CA semaine — limite TTE = 90 % |

#### Filtres
- **Rôle** : pour ne voir qu'une catégorie (ex. « tous les vendeurs »)
- **Statut** : actif / suspendu
- **Recherche** : nom, prénom, ID Discord, ID Perso

#### Tableau effectif
Une ligne par employé avec :
- **Nom + rôle** (badge coloré)
- **ID Discord** (utile pour matcher avec les logs)
- **Heures de service** de la semaine — si < 7h, marqueur ⚠
- **CA / Quota** (varie selon le rôle) :
  - Vendeur : `CA généré / 40 000` (plafond CA)
  - Pompiste : `% score` (moyenne bidons + caoutchoucs)
  - Responsable / Direction / DRH : « Décidé »
- **Salaire estimé / plafond**
- **Statut** + bouton **« Détail »**

### Ce que tu peux faire

#### 🔍 Voir le détail d'un employé
- Clique **« Détail »** sur n'importe quelle ligne → modale avec :
  - Infos perso : ID Discord, ID Perso, date d'entrée
  - Heures service de la semaine + sessions individuelles
  - Salaires versés cette semaine (depuis `/paies`)
  - Salaire estimé pour la semaine + plafond TTE applicable

  **Pour un vendeur** : CA généré, bénéfice généré, nb de ventes
  **Pour un pompiste** : bidons / quota, caoutchoucs / quota, score %
  **Pour responsable / direction / DRH** : champ **« Salaire décidé »** + bouton **« Décider salaire »**

#### 💰 Décider un salaire (responsables, direction, DRH inclus)
- Saisis le montant dans le champ
- Le système refuse si > plafond du rôle
- Plafonds :
  - Direction (Patron/Co-Patron/DRH) : **20 000 $/sem**
  - Responsable (Vente/Pompiste) : **17 000 $/sem**
- Clique **« Décider salaire »** → enregistré immédiatement

> ⚠ Tu peux décider **ton propre salaire** (DRH = 20 000 $ max). Logiquement ça doit être validé tacitement avec le Patron.

### Ce que tu peux AUSSI faire (stocks épicerie + essence)
- ✅ **Ajouter un nouveau produit** au catalogue (Stocks épicerie → « + Ajouter un produit »)
- ✅ **Modifier** les fiches produits existantes (nom, prix achat/vente, seuil)
- ✅ **Ajuster manuellement les stocks** épicerie (avec justification obligatoire — tracé dans les mouvements)
- ✅ **Gérer les stations essence** : ajouter / supprimer une station, modifier sa capacité, son prix, son stock actuel, son N° de pompe
- ✅ Les Responsables Vente peuvent modifier les fiches mais **pas créer** de nouveaux produits — c'est ton rôle (et celui de la direction)

### Ce que tu ne peux PAS faire

- ❌ Ajouter une dépense (Comptabilité lecture seule)
- ❌ Modifier la **Configuration globale** dans Administration (quotas, prix essence, webhook — réservée à la direction)
- ❌ Gérer les comptes **Patron** et **Co-Patron** (hors périmètre — apparaissent grisés dans Administration)

> Si tu as besoin d'une de ces actions → demande au Patron ou Co-Patron.

---

## ⚙ Le module Administration (gestion des comptes)

Tu y accèdes via la sidebar — **« ⚙ Administration »**.

### Ton périmètre
- ✅ Tu peux **créer / modifier / suspendre / supprimer** : DRH, Responsables, Vendeurs, Pompistes
- ❌ Tu ne peux **pas** toucher à : Patron, Co-Patron (lignes grisées)
- ✅ Tu peux changer le rôle d'un employé (ex. promouvoir un Vendeur Novice → Intermédiaire)

### Créer un compte
Bouton **« + Créer un compte »**. Remplis :
- Prénom, NOM, Email
- ID Discord, ID Perso (in-game) — **les deux sont indispensables** pour que ses ventes/paies/heures soient bien attribuées
- Rôle (limité à ton périmètre)
- Mot de passe provisoire (bouton « Générer » dispo)

À la création, le site affiche les credentials (email + mot de passe) → transmets-les à l'employé. Au premier accès, il sera forcé à changer son mot de passe.

### Suspendre / Supprimer
- **Suspendre** = licenciement RP. L'employé perd l'accès immédiatement, le compte reste consultable et réactivable. Confirmation 3 secondes.
- **Supprimer définitivement** : confirmation 3 secondes + **tape `SUPPRIMER`** pour activer le bouton. Supprime le profil Firestore. ⚠ Le compte Firebase Auth (login/email) doit être supprimé séparément depuis la console Firebase pour libérer l'email — demande à la direction.

### À ne pas faire
- ❌ Ne supprime pas un compte sans avoir noté ses derniers chiffres (les ventes/paies passées restent en base mais lui-même disparaît)
- ❌ Ne donne **jamais** un mot de passe par téléphone vocal — toujours via DM Discord ou autre canal écrit traçable

---

## 💡 Comprendre les calculs de paie

### Vendeur
```
commission = 32,5 % (Novice) / 35 % (Inter) / 37,5 % (Exp)
plafond    = 13 000 / 14 000 / 15 000 $ (Novice / Inter / Exp)

Si CA généré > 40 000 $ :
   bénéfice retenu = bénéfice × (40 000 / CA)
Sinon :
   bénéfice retenu = bénéfice total

Salaire = MIN( bénéfice retenu × commission , plafond )
```

**Exemple concret** (Vendeur Intermédiaire) :
- CA : 35 000 $
- Bénéfice : 18 000 $
- Salaire = MIN(18 000 × 35 %, 14 000) = MIN(6 300, 14 000) = **6 300 $**

**Exemple plafonné** (Vendeur Expérimenté) :
- CA : 60 000 $ (au-dessus du plafond CA de 40 000)
- Bénéfice total : 30 000 $
- Bénéfice retenu = 30 000 × (40 000 / 60 000) = **20 000 $**
- Salaire = MIN(20 000 × 37,5 %, 15 000) = MIN(7 500, 15 000) = **7 500 $**

### Pompiste
```
score bidons     = bidons / quotaBidons (max 100 %)
score caoutchouc = caoutchoucs / quotaCaoutchoucs (max 100 %)
score moyen      = (score bidons + score caoutchouc) / 2

Salaire = score moyen × plafond
```

**Exemple** (Pompiste Inter, plafond 14 000) :
- Bidons : 1 700 / 1 700 = 100 %
- Caoutchoucs : 600 / 800 = 75 %
- Score moyen = (100 + 75) / 2 = **87,5 %**
- Salaire = 87,5 % × 14 000 = **12 250 $**

### Responsable (Vente / Pompiste)
- Salaire fixe **décidé par toi** (DRH) ou la direction
- Plafond : **17 000 $/semaine** (refusé au-delà)

### Direction (Patron / Co-Patron / DRH)
- Salaire fixe décidé
- Plafond : **20 000 $/semaine**

---

## 📜 Conformité TTE — ce que tu surveilles

### Plafonds individuels (déjà bloqués par le site)
| Rôle | Plafond hebdo |
|------|---------------|
| Vendeur Novice | 13 000 $ |
| Vendeur Intermédiaire | 14 000 $ |
| Vendeur Expérimenté | 15 000 $ |
| Pompiste Novice | 13 000 $ |
| Pompiste Intermédiaire | 14 000 $ |
| Pompiste Expérimenté | 15 000 $ |
| Responsable Vente / Pompiste | 17 000 $ |
| DRH / Co-Patron / Patron | 20 000 $ |

### Masse salariale globale
- **≤ 85 %** : OK (vert)
- **85 % – 90 %** : Attention (orange) — alerte affichée
- **> 90 %** : **HORS TTE** (rouge) — il faut agir

> Si la masse dépasse 90 %, options :
> - Réduire un ou plusieurs salaires décidés (responsables, direction)
> - Augmenter le CA (vendre plus)
> - Identifier un employé en sous-régime (peu d'heures, peu de CA) qui plombe le ratio

### Primes (calculées automatiquement)

**Prime hebdomadaire (Art. 4-1.10) — sur le CA semaine** :
| CA semaine | Prime |
|------------|-------|
| 0–200 000 | 0 $ |
| 200 000–400 000 | 5 000 $ |
| 400 000–600 000 | 10 000 $ |
| > 600 000 | 15 000 $ |

**Prime mensuelle (Art. 4-1.11) — sur le bénéfice net du mois** :
| Bénéfice net mois | Prime |
|-------------------|-------|
| 0–500 000 | 0 $ |
| 500 000–1 000 000 | 20 000 $ |
| 1 000 000–2 000 000 | 40 000 $ |
| > 2 000 000 | 60 000 $ |

> Tu n'as **rien à saisir** pour les primes. Le système les calcule à chaque clôture.

---

## 📅 Ta semaine type

### Lundi matin
- Vue rapide du dashboard
- Module **RH** : note les employés actifs / suspendus, vérifie les nouveaux

### Mardi → Jeudi
- Surveille les heures de service de chacun (filtre par rôle)
- Si quelqu'un n'a pas encore fait d'heures → message Discord pour rappel

### Vendredi
- Moment clé : **vérifie que la masse salariale prévue ≤ 90 %**
- Décide / ajuste les salaires des responsables et de la direction
- Si masse trop haute : revois les salaires fixes à la baisse

### Dimanche soir
- Dernière vérification : tous les chiffres sont-ils cohérents ?
- Aucune action manuelle nécessaire — la clôture est automatique à 00h00 lundi

---

## 🚨 Les 3 erreurs DRH à éviter

1. **Décider un salaire par à-coups** sans vérifier la masse globale après. Toujours regarder le KPI « masse salariale % » dans le dashboard ou la compta.
2. **Oublier qu'un employé suspendu n'apparaît plus en effectif actif** mais peut encore avoir des paies versées dans la semaine (filtre statut « tous » pour vérifier).
3. **Modifier ton propre salaire au max** sans accord de la direction. Légalement tu peux, RP-ment c'est très mal vu.

---

## ➡ La suite

- **[07-automatismes.md](07-automatismes.md)** : pour comprendre comment les heures de service et les paies arrivent automatiquement depuis Discord
- **[08-faq-depannage.md](08-faq-depannage.md)** : « pourquoi cet employé n'a pas de salaire estimé ? », etc.
