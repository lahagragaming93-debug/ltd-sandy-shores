# 💵 Guide Vendeur

> Tu es **vendeur** au LTD (Novice, Intermédiaire ou Expérimenté). Le site te montre **ton CA, ton bénéfice, ta progression et ta paie**. Tu n'as rien à saisir manuellement — tout est automatique depuis les logs Discord.

---

## 🎯 Tes 2 pages

| Page | Contenu |
|------|---------|
| 👤 **Mon espace** | Tes performances de la semaine (CA, bénéfice, progression, salaire estimé) |
| 💰 **Mes paies** | L'historique des paies que tu as reçues |

C'est tout ! En tant que vendeur, tu as un accès très restreint et c'est normal — tu te concentres sur ton boulot.

---

## 👤 Mon espace

### Ce que tu vois en haut
- 👋 Message de bienvenue avec ton prénom
- **Ton rôle** (Vendeur Novice / Inter / Exp)

### KPI vendeur

| KPI | Signification |
|-----|---------------|
| **Mon CA** | Total des montants des factures que tu as faites cette semaine |
| **Mon bénéfice** | CA × ta commission (32,5 % / 35 % / 37,5 %) |
| **Progression CA** | Barre vers le plafond de 40 000 $ (au-delà, le bénéfice retenu plafonne) |
| **Salaire estimé** | Ce que tu vas recevoir en fin de semaine, plafonné selon ton grade |

### Tableau de tes ventes
30 dernières factures :
- Date / heure
- Client (nom RP)
- Montant facturé
- Bénéfice généré (en fonction du prix d'achat des produits vendus)

### Heures de service
Toutes tes prises et fins de service de la semaine, avec durée totale.
- ✅ Si total ≥ 7h : marqueur OK
- ⚠ Si < 7h : à compléter (sinon ta paie sera ridicule)

### Ce que tu peux faire
- **Lecture seule.** Tu ne modifies rien, tout vient des logs Discord.

---

## 💰 Mes paies

### Ce que tu vois
- **Ce que tu as reçu cette semaine** + plafond TTE de ton grade
- **Ce que tu as reçu ce mois**
- **Total reçu** depuis ton entrée
- **Tableau** des paies : date, qui t'a payé, montant, période

### Si tu ne vois pas une paie qui aurait dû arriver
- Vérifie d'abord avec ton responsable / la direction (le bot Discord est-il actif ?)
- Vérifie que **ton ID Perso est bien renseigné** dans ton profil (sinon le bot ne sait pas que c'est toi qu'on paie)
- Si tout est OK : ouvre un ticket Discord à la direction

---

## 💡 Comprendre ta paie

### Formule
```
commission = 32,5 % (Novice) / 35 % (Inter) / 37,5 % (Exp)
plafond    = 13 000 $ (Novice) / 14 000 $ (Inter) / 15 000 $ (Exp)

Si CA > 40 000 $ :
   bénéfice retenu = bénéfice × (40 000 / CA)
Sinon :
   bénéfice retenu = bénéfice total

Salaire = MIN( bénéfice retenu × commission, plafond )
```

### En clair

#### Cas 1 — CA inférieur au plafond CA (40 000)
Ton salaire = ton bénéfice × ta commission.

**Exemple Vendeur Inter** :
- Tu fais 25 000 $ de CA dans la semaine
- Bénéfice généré : 12 000 $
- Salaire = 12 000 × 35 % = **4 200 $**

#### Cas 2 — CA supérieur à 40 000 (plafond CA)
Ton bénéfice est **proportionnellement réduit** : on retient seulement la part qui correspond aux 40 000 premiers $ de CA.

**Exemple Vendeur Exp** :
- Tu fais 60 000 $ de CA
- Bénéfice généré : 30 000 $
- Bénéfice retenu = 30 000 × (40 000 / 60 000) = **20 000 $**
- Salaire = 20 000 × 37,5 % = **7 500 $**

> 💡 Vendre **plus de 40 000 $ de CA** ne fait **plus monter ta commission**. Mais ça reste utile pour le LTD (et pour les primes hebdo collectives).

#### Cas 3 — Salaire au plafond
Si ton calcul donne plus que le plafond de ton grade, c'est plafonné.

**Exemple Vendeur Novice** :
- CA : 35 000 $, bénéfice : 22 000 $
- Calcul : 22 000 × 32,5 % = 7 150 $
- Plafond Novice = 13 000 $ → tu ne dépasses pas → **7 150 $**

Pour atteindre le plafond Novice, il faudrait :
- Bénéfice × 32,5 % ≥ 13 000
- Soit bénéfice ≥ 40 000 (avec un CA correspondant)

---

## 📈 Comment maximiser ta paie

### 1. Joue sur le bénéfice, pas juste le CA
- Le calcul prend le **bénéfice** (CA − coût d'achat des produits vendus)
- Vendre des produits à **forte marge** est plus rentable que des produits à faible marge
- Tu peux voir les marges en demandant à ton **Responsable Vente**

### 2. Optimise tes heures de service
- Pas d'heures = pas de présence = pas de ventes attribuées (et la direction ne te paiera pas)
- Vise au moins **7h/semaine** pour que ton activité soit jugée régulière

### 3. Vérifie tes IDs
Va voir un Patron pour qu'il vérifie que ton compte a bien :
- **ID Discord** renseigné (pour que tes ventes te soient attribuées)
- **ID Perso** renseigné (pour que tes paies te soient attribuées)

Sans ces deux IDs, tu travailles dans le vide — rien ne sera attribué à ton nom.

### 4. Évite les discordances
Une « discordance » = une facture que tu fais sans qu'une sortie de stock soit détectée. Si ça arrive trop souvent, ton responsable et la direction vont enquêter (bug bot ou vol). Joue clean : facture toujours après avoir sorti la marchandise du stock.

---

## ⚠ Ce que tu ne peux PAS voir / faire

- ❌ Le Dashboard global (CA total LTD)
- ❌ La liste des autres employés
- ❌ Les comptes / rôles d'autres personnes
- ❌ Modifier les prix
- ❌ Voir les ventes des autres vendeurs
- ❌ Décider ton propre salaire (c'est calculé, pas négocié)

C'est normal et c'est par sécurité — chacun ne voit que ses propres infos.

---

## 📅 Ta semaine type

### Tous les jours
- En arrivant en service → vérifie ton **Mon espace** :
  - Combien j'ai déjà fait ?
  - Combien me reste-t-il pour atteindre les 40 000 $ ?
  - Mon salaire estimé évolue-t-il bien ?

### Fin de service
- Vérifie que **toutes tes ventes apparaissent** dans le tableau (sinon il y a peut-être un problème de log Discord)

### Dimanche soir → Lundi 00h00
- La semaine se clôture automatiquement
- Tes compteurs (CA, bénéfice, etc.) sont **remis à zéro pour la nouvelle semaine**
- Tu peux toujours voir tes paies passées dans **Mes paies**

---

## ❓ Questions fréquentes

**« Pourquoi mon CA ne monte pas après ma vente ? »**
Le bot Discord n'a peut-être pas remonté ta facture (canal `#suivi-facture`). Attends 30 secondes, sinon préviens ton responsable.

**« Pourquoi mon salaire estimé est nul alors que j'ai vendu ? »**
Probablement parce que les prix d'achat ne sont pas renseignés sur les produits que tu as vendus → pas de calcul de bénéfice possible → pas de commission. Demande à ton Responsable Vente de mettre à jour les prix d'achat.

**« Est-ce que je peux dépasser le plafond ? »**
Non, c'est un plafond légal TTE. Pour gagner plus, il faut **monter en grade** (Novice → Inter → Exp).

Plus de questions ? Va voir [08-faq-depannage.md](08-faq-depannage.md).
