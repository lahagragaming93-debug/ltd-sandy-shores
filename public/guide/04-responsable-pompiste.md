# ⛽ Guide Responsable Pompiste

> Tu pilotes les **8 stations-essence** : tu fixes les prix, gères les capacités, suis les redistributions de ton équipe.

---

## 🎯 Tes 2 modules principaux

| Module | Accès | Rôle |
|--------|-------|------|
| ⛽ **Stations essence** | **Lecture + écriture** | C'est ton outil principal |
| 🧑‍💼 RH | Lecture | Voir l'effectif pompistes |
| 👤 Mon espace + 💰 Mes paies | Lecture | Tes infos perso |

> 🔒 Tu **n'as pas accès** à : Dashboard, Stocks épicerie, Ventes, Comptabilité, Administration.

---

## ⛽ Stations essence — Ton outil principal

### Les 8 stations du LTD

| Station | Capacité max | Prix au litre |
|---------|--------------|---------------|
| Senora Way - Rex's Diner | 10 000 L | 5 $ |
| Route 68 LTD | 7 500 L | 5 $ |
| Route 68 | 10 000 L | 5 $ |
| Aérodrome Sandy Shores (Panorama Drive) | 5 000 L | 5 $ |
| Favélas (Palomino Freeway) | 15 000 L | 6 $ |
| Vinewood (Clinton Avenue) | 15 000 L | 5,50 $ |
| Cholla Springs Avenue | 5 000 L | 4,50 $ |
| Algonquin Boulevard | 5 000 L | 4,50 $ |

> Chaque station a un **seuil d'alerte** à **20 % de la capacité max** par défaut.

### Ce que tu vois

#### KPI en haut
- **Nb stations** (8)
- **Stock total** (en L et en %)
- **Stations en alerte** (sous seuil)
- **Quota bidons** par semaine (utilisé pour calcul paie pompiste)

#### Grille des stations
Chaque station = une carte avec :
- Nom + badge OK / ALERTE
- Barre de progression (stock actuel / max)
- Prix au litre
- Seuil d'alerte
- Bouton **« Modifier / redistribuer »**

#### Redistributions de la semaine
Tableau avec : date, station, litres redistribués, prix au litre, montant, stock après.

### Ce que tu peux faire

#### ➕ Ajouter une station
Bouton **« + Ajouter une station »** :
| Champ | Quoi mettre |
|-------|-------------|
| **Nom** (obligatoire) | Le nom commercial complet |
| **Stock actuel** | Combien de L au moment de la création |
| **Stock max** | Capacité totale (défaut 30 000) |
| **Seuil d'alerte** | À partir de combien de L on alerte (défaut depuis config) |
| **Prix au litre** | Tarif vendu au client (défaut depuis config) |

> Cas d'usage : nouvelle station ouverte par le LTD, ou pour test/diag.

#### ✏ Modifier une station
Bouton **« Modifier / redistribuer »** sur une station :
- Modifie : nom, stock actuel, stock max, seuil, prix
- Bouton **Supprimer** (modal CRITIQUE 3 sec + tape `SUPPRIMER`)

> 💡 Le **stock baisse automatiquement** à chaque vente (les FiveM logs `#suivi-essence` ne sont pas parsés actuellement — seules les redistributions le sont). Tu peux ajuster le stock manuellement ici si besoin.

#### ⚙ Configuration globale (essence)
Bouton **« ⚙ Configuration »** — modale globale :

| Paramètre | Défaut | Impact |
|-----------|--------|--------|
| **Quota bidons / semaine** | 1 700 | Cible bidons par pompiste pour atteindre 100 % de salaire |
| **Quota caoutchoucs / semaine** | 800 | Cible caoutchoucs par pompiste |
| **Prix essence par défaut** | 5 $ | Pour création de nouvelles stations |
| **Seuil d'alerte essence** | (à définir) | Alerte par défaut sur nouvelles stations |

> ⚠ La config quota / prix est **partagée avec l'Administration**. Si tu modifies ici, c'est aussi visible côté Patron. Coordonne avec la direction avant de toucher aux quotas.

### Bonnes pratiques

#### ✅ À faire
- **Surveille les niveaux** chaque jour : 1-2 stations sous seuil = pompiste à dispatcher
- **Adapte les prix** par station selon la zone RP (Vinewood plus cher, Cholla moins cher est déjà la stratégie en place)
- **Vérifie après chaque redistribution** que le stock est bien remonté

#### ❌ À ne pas faire
- ❌ **Ne baisse pas les quotas bidons sans accord direction** — impact direct sur la paie pompiste (et sur le service à fournir)
- ❌ Ne modifie pas le stock actuel manuellement « pour l'arrondir » — tu casses l'audit
- ❌ Ne supprime pas une station historique (Vinewood, Senora) sans réflexion — toutes les redistributions liées resteront orphelines
- ❌ Ne mets pas un prix négatif ou à 0 (le site bloque, mais ne tente pas de contourner)

---

## 🧑‍💼 RH — Vue lecture seule

Tu peux **voir** :
- Tes pompistes : noms, IDs Discord, heures, score (% bidons + caoutchoucs)
- Performance comparée

Tu ne peux **pas** modifier les rôles, salaires ou statuts.

> 💡 Si un pompiste est en sous-régime (score < 50 %), parle-lui avant d'alerter la direction.

---

## 💰 Comprendre les paies pompistes (pour bien encadrer)

### Calcul (rappel pour pédagogie)
```
score bidons     = bidons réalisés / quotaBidons (max 100 %)
score caoutchouc = caoutchoucs réalisés / quotaCaoutchoucs (max 100 %)
score moyen      = (bidons + caoutchouc) / 2

Salaire = score moyen × plafond
```

### Plafonds
- Pompiste Novice : 13 000 $
- Pompiste Inter : 14 000 $
- Pompiste Exp : 15 000 $

### Exemples

| Pompiste | Bidons | Caoutchoucs | Score | Salaire (Inter) |
|----------|--------|-------------|-------|-----------------|
| Modèle | 1 700 | 800 | 100 % | 14 000 $ |
| Bon | 1 500 | 700 | (88+88)/2 = 88 % | 12 320 $ |
| Moyen | 1 000 | 500 | (59+62)/2 = 61 % | 8 540 $ |
| Faible | 500 | 200 | (29+25)/2 = 27 % | 3 780 $ |

> Les quotas sont configurables dans **Stations → ⚙ Configuration**. Plus tu les augmentes, plus c'est dur d'atteindre 100 %.

---

## 📅 Ta semaine type

### Lundi matin
- **Stations** : checke le niveau de chacune
- Identifie celles qui ont fini la semaine basses → priorité de redistribution
- Brief tes pompistes (Discord, vocal)

### En cours de semaine
- **2-3 fois par jour**, regarde la grille des stations (pas besoin de rafraîchir, c'est temps réel)
- Si une station passe en ALERTE (bandeau ⚠ visible) → dispatch un pompiste

### Vendredi
- **Bilan de la semaine** : combien de redistributions ? Sur quelles stations ?
- Note les pompistes en sous-régime pour le DRH/Patron

### Dimanche
- Rien à faire — clôture automatique

---

## 💰 Ta propre paie

Comme le Responsable Vente, tu es en **salaire fixe** :
- **Plafond TTE** : 17 000 $/semaine
- **Pas de commission** sur les redistributions de tes pompistes
- Décidé par la direction / DRH

---

## 🚨 Les 3 erreurs à éviter

1. **Quotas trop bas** = pompistes au plafond facile = paie qui explose la masse salariale
2. **Quotas trop hauts** = pompistes démotivés (impossible d'atteindre 100 %)
3. **Stations en rupture prolongée** = clients déçus, perte de CA, plainte direction

---

## ➡ La suite

- **[07-automatismes.md](07-automatismes.md)** : comment les redistributions sont détectées depuis Discord (`#suivi-achat-essence`)
- **[08-faq-depannage.md](08-faq-depannage.md)** : « la station n'a pas baissé après cette redistribution »
