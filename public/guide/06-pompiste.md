# 🚗 Guide Pompiste

> Tu es **pompiste** au LTD (Novice, Intermédiaire ou Expérimenté). Ton job : **redistribuer l'essence** aux 8 stations et **fournir des bidons et caoutchoucs** aux clients. Le site te montre ta progression et ta paie.

---

## 🎯 Tes 2 pages

| Page | Contenu |
|------|---------|
| 👤 **Mon espace** | Tes performances de la semaine (bidons, caoutchoucs, score, salaire) |
| 💰 **Mes paies** | L'historique des paies que tu as reçues |

C'est tout. Pas d'accès aux stations, aux ventes, aux comptes — uniquement tes propres chiffres.

---

## 👤 Mon espace

### Ce que tu vois en haut
- 👋 Message de bienvenue
- **Ton rôle** (Pompiste Novice / Inter / Exp)

### KPI pompiste

| KPI | Signification |
|-----|---------------|
| **Bidons réalisés** | Nombre de bidons que tu as fournis cette semaine (compté depuis `#logs-ig`) |
| **Caoutchoucs réalisés** | Nombre de caoutchoucs fournis cette semaine |
| **Score %** | Moyenne (% bidons + % caoutchoucs) — c'est ton indicateur principal |
| **Salaire estimé** | Score × plafond de ton grade |

### Les 2 progress bars
- **Bidons** : `X / quota` (par défaut quota = 1 700/sem)
- **Caoutchoucs** : `Y / quota` (par défaut quota = 800/sem)

> Les quotas sont définis par la direction et le Responsable Pompiste dans **Configuration globale**. Ils peuvent évoluer.

### Heures de service
Comme pour les vendeurs : toutes tes prises et fins de service de la semaine.
- ✅ Si total ≥ 7h : marqueur OK
- ⚠ Si < 7h : tu n'es pas considéré comme actif sur la semaine

### Ce que tu peux faire
- **Lecture seule.** Pas d'action sur cette page. Tout vient des logs Discord.

---

## 💰 Mes paies

Identique à la page Vendeur :
- Paie de la semaine en cours
- Paie du mois
- Total reçu depuis ton entrée
- Tableau historique : date, payeur, montant, période

> Si une paie manque, vérifie que **ton ID Perso est bien renseigné** dans ton profil (le bot Discord matche les paies sur l'ID Perso). Sinon, contacte la direction.

---

## 💡 Comprendre ta paie

### Formule
```
score bidons     = MIN(1, bidons / 1700)
score caoutchouc = MIN(1, caoutchoucs / 800)
score moyen      = (score bidons + score caoutchouc) / 2

Salaire = score moyen × plafond
```

### En clair : ton salaire est divisé en 2 moitiés
- **Moitié bidons** : si tu fais les 1700 bidons → tu gagnes la moitié du plafond.
- **Moitié caoutchoucs** : si tu fais les 800 caoutchoucs → tu gagnes l'autre moitié.

**Combien rapporte 1 unité ?** (Novice = plafond 13 000 $, donc moitié = 6 500 $) :
- 1 bidon ravitaillé = `6 500 / 1700` = **3,82 $**
- 1 caoutchouc produit = `6 500 / 800` = **8,13 $**

**Pareil pour Inter (14k → 4,12$ + 8,75$) et Exp (15k → 4,41$ + 9,38$).**

> 💡 Tu touches **dès le 1er bidon ou caoutchouc**. Tu peux faire d'abord tous tes bidons (et toucher 6 500 $ Novice = ½ du plafond), puis t'attaquer aux caoutchoucs. Chaque ajout incrémente ton salaire estimé en temps réel.

### Plafonds
- Pompiste Novice : **13 000 $/sem**
- Pompiste Intermédiaire : **14 000 $/sem**
- Pompiste Expérimenté : **15 000 $/sem**

### En clair

#### Cas 1 — Quotas atteints à 100 %
Tu touches le **plafond plein**.

**Pompiste Inter** :
- Bidons : 1 700 / 1 700 = 100 %
- Caoutchoucs : 800 / 800 = 100 %
- Score = 100 %
- Salaire = **14 000 $**

#### Cas 2 — Une catégorie en retard
La moyenne baisse mais tu touches quand même quelque chose.

**Pompiste Inter** :
- Bidons : 1 700 / 1 700 = 100 % ✓
- Caoutchoucs : 400 / 800 = 50 %
- Score moyen = (100 + 50) / 2 = 75 %
- Salaire = 75 % × 14 000 = **10 500 $**

#### Cas 3 — Largement au-dessus du quota
Le score est **plafonné à 100 % par catégorie** — pas de bonus pour faire plus que le quota.

**Pompiste Exp** :
- Bidons : 3 000 (vs quota 1 700) → 176 % → **plafonné à 100 %**
- Caoutchoucs : 800 / 800 = 100 %
- Score moyen = 100 %
- Salaire = **15 000 $** (plafond Exp)

> 💡 Une fois ton quota atteint, **arrête pas pour autant** — tu rends service à l'équipe et au LTD, mais ton salaire ne montera plus. Si tu veux gagner plus, demande à monter en grade.

---

## 📈 Comment maximiser ta paie

### 1. Équilibre les 2 catégories
Le score est une **moyenne**. Faire 200 % en bidons et 0 en caoutchoucs te donne 50 % de score, pas 100 %.

### 2. Monte en grade
Le **plafond** est fixe par grade :
- Novice : 13 000 $ max
- Inter : 14 000 $ max
- Exp : 15 000 $ max

Pour passer Inter ou Exp, il faut le faire valider par la direction (ancienneté + performance).

### 3. Vérifie tes IDs
Ton compte doit avoir :
- **ID Discord** renseigné → pour que les bidons / caoutchoucs comptés depuis Discord te soient attribués
- **ID Perso** (in-game) renseigné → pour que les paies te soient attribuées

Sans ces deux IDs, tes performances ne sont pas comptabilisées.

### 4. Fais tes heures de service
Si tu n'es pas en service quand tu produis des bidons, tes activités peuvent ne pas être comptées correctement. Toujours **commencer ton service** sur Discord avant de bosser.

---

## ⚠ Ce que tu ne peux PAS faire

- ❌ Voir les autres pompistes (uniquement la direction et ton responsable peuvent)
- ❌ Modifier les niveaux des stations
- ❌ Changer les quotas (responsable pompiste / direction)
- ❌ Voir les chiffres globaux du LTD
- ❌ Décider ton propre salaire (c'est calculé)

---

## 📅 Ta semaine type

### Tous les jours en service
- Avant de commencer → check **Mon espace** : où j'en suis sur le quota ?
- En cours de service, regarde régulièrement (1× par heure) ta progression

### Fin de service
- Vérifie que tes bidons / caoutchoucs sont bien comptés
- Si le compteur ne bouge pas après un gros bloc de production → préviens ton responsable (peut-être un bug bot)

### Dimanche soir → Lundi 00h00
- Clôture automatique
- Compteurs remis à 0
- Paie de la semaine consultable dans **Mes paies**

---

## ❓ Questions fréquentes

**« Pourquoi mes bidons n'augmentent pas ? »**
Le bot Discord scrute le canal `#logs-ig` pour détecter les inventaire-add de bidons d'essence. Si tu produis bien et que ça ne monte pas :
- Vérifie que tu es bien en service
- Vérifie ton ID Discord dans ton profil (sinon le bot ne sait pas que c'est toi)
- Préviens ton responsable

**« Pourquoi je n'ai pas reçu de paie ce mois-ci ? »**
Vérifie ton **ID Perso** dans ton profil. Le bot matche les paies via l'ID Perso (in-game). Sans ça, l'argent versé ne te sera pas attribué.

**« Si je dépasse le quota, je gagne plus ? »**
Non, le score est plafonné à 100 % par catégorie. Pour gagner plus, il faut monter en grade.

**« Et les heures de service, c'est obligatoire ? »**
Pas obligatoire au sens strict, mais en dessous de 7h/semaine tu es noté comme « inactif » par la direction et tes performances apparaîtront comme anormales dans les rapports.

Plus de questions ? Va voir [08-faq-depannage.md](08-faq-depannage.md).
