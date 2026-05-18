# 15 — Glossaire RP, acronymes et jargon

> Vocabulaire spécifique au projet et au monde RP FiveM Sandy Shores. Utile pour comprendre les conversations user et le code.

---

## 🏷 Acronymes courants

| Acronyme | Signification | Usage |
|---|---|---|
| **LTD** | Local du Travail Détaillant | Type d'entreprise RP (petit commerce). Le LTD Sandy Shores est une épicerie + stations-essence. |
| **TTE** | Traité Travail Entreprise | Loi fiscale du serveur RP qui régit les entreprises (équivalent code du travail + fiscal). |
| **IRS** | Internal Revenue Service | Administration fiscale RP. Vient contrôler la comptabilité du LTD. |
| **RP** | Role Play | Le jeu de rôle en général. |
| **DRH** | Directeur·rice des Ressources Humaines | Rôle du LTD qui gère l'effectif et les paies. |
| **IG** | In Game | Action qui se passe dans le jeu FiveM (vs site web ou Discord). |
| **DA** | Direction Artistique | L'identité visuelle d'un projet (logo, palette, typo). |
| **CA** | Chiffre d'Affaires | Recettes brutes (somme des ventes). |
| **CAR** | CA Retenu | CA pris en compte pour calcul commission (souvent plafonné). |

---

## 🎭 Rôles RP / personnages connus du squelette

### Direction Sandy Shores (à remplacer pour nouveau LTD)
- **Blake MARS** — Patron RP du LTD Sandy Shores (reprise de l'entreprise mai 2026)
- **Luciana ANGEL MARS** — Co-patron RP
- **Broas NESQUIK** — DRH RP

### Support technique
- **Andrew BEAUCHAMP** — Admin technique (rôle de transition pendant la passation du setup au vrai patron RP)
- **BLATV** — Signature développeur (l'auteur du squelette)

### IRS / institutions
- **Abraham THORPE** — Signataire IRS pour la subvention essence 14/05/2026 (300k$ à rembourser)
- **Governor of San Andreas (IRS)** — Bénéficiaire institutionnel des remboursements

---

## 🤖 Mods et outils RP

| Nom | Description |
|---|---|
| **FaabHook** | Mod tier qui remonte automatiquement les logs IG (factures, paiements, ravitaillements) sur Discord via embeds. Le bot LTD parse ces embeds. |
| **xbankaccount** | Système bancaire RP. Les entrées/sorties du compte LTD sont tracées via ce système et remontées sur Discord. |
| **F1 menu** | Menu en jeu pour annuler une facture (génère un embed d'annulation). |
| **/pay @user montant** | Commande Discord du bot RP pour verser une paie (alternative au "en jeu"). ⚠ Mais Sandy Shores fait les paies **en jeu** uniquement, le bot Discord ne fait que remonter le log. |

---

## 💵 Fournisseurs RP

| Nom | Type | Déductible | Notes |
|---|---|---|---|
| **Yootool** | Matières premières | ✅ Oui | Boutique N°263 du serveur RP, fournisseur principal épicerie |
| **Fournisseur LTD** | Matières premières (achats en gros) | ✅ Oui | Boutique N°215 |
| **HDM (Heavy Duty Motors)** | Concessionnaire véhicules | ❌ Non (sauf accord IRS) | Compte cible 67978 |
| **Dynasty 8** | Décoration locaux | ❌ Non | Compte cible spécifique |
| **GB Foundry** | Matières premières / artisanat | ✅ Oui (selon contexte) | À ajuster selon usage |
| **Achat essence (carte entreprise)** | Frais véhicule | ✅ Oui | Auto-classification "frais-vehicule" |

---

## 📅 Termes liés à la clôture

| Terme | Définition |
|---|---|
| **Clôture étape 1** | Cron lundi 00h00 qui fige CA + dépenses. Status `cloturee-partielle`. |
| **Clôture étape 2** | Cron mardi 21h05 (filet de sécurité) ou clic manuel patron 🔒. Fige masse salariale + bénéfice net. Status `cloturee-manuelle` ou `cloturee`. |
| **weekKey** | Identifiant unique d'une semaine, format `YYYY-MM-DD` du lundi (ex: `'2026-05-11'`). |
| **Semaine RP** | Du lundi 00h00 au dimanche 23h59 Paris. |
| **Semaine ISO** | Numéro 1-53 selon ISO 8601 (la semaine du 11/05/2026 = S20). |
| **Fenêtre paie post-dim** | Période de récolte des paies pour la semaine N : lundi N+1 00h00 → mardi N+1 21h00 Paris. |
| **weekKeyAttribuee** | Champ sur une paie qui dit "cette paie compte logiquement pour la semaine X" (posé à la clôture). |
| **Snapshot** | Doc Firestore `/paiesEstimees` figé à la clôture (Option B v1.6.0+). Ne change plus même si on supprime le compte employé. |

---

## 💰 Termes comptables RP

| Terme | Définition / formule |
|---|---|
| **CA produits** | Somme des ventes épicerie (cf `/ventes` filtrées) |
| **CA carburant** | Somme des `/redistributions` (ventes essence agrégées par station) |
| **CA total** | CA produits + CA carburant |
| **Bénéfice brut** | CA - coût d'achat des produits vendus (basé sur `prixAchat` du catalogue) |
| **Dépenses totales** | Somme des `/depenses` (hors paies = `type !== 'paie'`) |
| **Charges déductibles** | Sous-ensemble des dépenses avec `deductible: true` (réduit le résultat imposable) |
| **Charges non déductibles** | Dépenses avec `deductible: false` (ne réduisent pas l'impôt) |
| **Masse salariale** | Somme des `/paies` effectivement versées dans la fenêtre paie post-dim |
| **Bénéfice net** | CA total - dépenses totales - masse salariale = "ce que le LTD a vraiment empoché" |
| **Résultat imposable** | (CA + autres revenus) - charges déductibles = base de l'impôt TTE Art. 4-2.4 |
| **Impôt estimé** | Calculé selon tranches Art. 4-3.2 sur le bénéfice net positif |
| **Solde opérationnel** | Solde banque LTD - subventions reçues = trésorerie hors aides exceptionnelles |
| **Prime hebdo potentielle** | Selon tranches CA (Art. 4-1.10) : 0/5k/10k/15k |
| **Prime mensuelle potentielle** | Selon tranches bénéfice net (Art. 4-1.11) : 0/20k/40k/60k |

---

## 👔 Rôles et grades employés

### Vendeurs
- **vendeur-novice** : nouveau venu. Commission 13 %.
- **vendeur-intermediaire** : confirmé. Commission 14 %.
- **vendeur-experimente** : expert. Commission 15 %.

Les commissions ne s'appliquent que sur le **CA particulier** (produits avec `pourPro: false`).

### Pompistes
- **pompiste-novice** : 1 700 bidons + 800 caoutchoucs / semaine
- **pompiste-intermediaire** : quotas plus élevés
- **pompiste-experimente** : quotas max

Le **score** mesure l'atteinte des quotas (0-100%+).

### Responsables
- **responsable-vente** : encadre les vendeurs, gère stocks épicerie
- **responsable-pompiste** : encadre les pompistes, gère stations

### Direction
- **patron** : tous droits
- **co-patron** : tous droits sauf retrait du patron
- **drh** : RH + lecture compta + cocher Versé (pas de clôture)
- **admin-technique** : rôle de support (= patron en pratique)

---

## 🎯 Workflow & jargon technique

| Terme | Définition |
|---|---|
| **Bot Discord** | Le programme Node.js qui écoute les embeds FaabHook sur Discord et alimente Firestore. |
| **Cloud Function** | Endpoint backend Firebase, soit HTTP (`onRequest`) soit cron (`onSchedule`). |
| **Firestore** | Base de données NoSQL Firebase utilisée par le projet. |
| **GitHub Pages** | Hébergement frontend statique gratuit. Le site est déployé via push GitHub. |
| **IMPORTDATA** | Formule Google Sheets qui fetch un CSV depuis une URL. Cache ~1h. |
| **Service account** | Compte Google "robot" utilisé par les Cloud Functions pour écrire dans le Sheet. |
| **Bearer token** | Token Firebase Auth ID passé en header `Authorization: Bearer <token>` pour authentifier les requêtes HTTP. |
| **Snapshot** | Dans le contexte du projet, fait référence aux `/paiesEstimees` (snapshots paies) ou aux onglets `Semaine N` du Sheet (snapshots de l'état comptable à la clôture). |
| **CSV** | Format texte tabulaire utilisé par `comptaExport` pour alimenter les onglets live du Sheet. |
| **Cron** | Fonction planifiée qui s'exécute à intervalles réguliers (ex: lundi 00h00). |

---

## 📊 Termes RP-fiscaux

| Terme | Définition |
|---|---|
| **Déclaration fiscale** | Soumettre les chiffres de la semaine sur le site IRS (RP) avant mardi 21h. Si oubli → +10% pénalité par 24h. |
| **Paiement impôts** | Verser l'impôt calculé sur le site IRS avant mercredi 21h. |
| **Contrôle fiscal** | Le contrôleur IRS RP vient inspecter la compta (consulte le Sheet partagé). |
| **Sanctions IRS** | Paliers 1-4 (5/7/10% du compte) en cas de non-conformité ou retard. |
| **Cessation de paiement** | Si bénéfice net < 0 pendant 4 semaines consécutives, l'entreprise doit déclarer cessation (mort RP). |
| **Subvention IRS** | Aide financière exceptionnelle de l'IRS (non imposable, remboursable selon contrat). |

---

## 🛒 Termes catalogue produits

| Terme | Définition |
|---|---|
| **pourPro** | Flag boolean sur un produit : `true` = vente professionnelle (B2B, pas de commission vendeur). `false` = particulier (commissionnable). |
| **Vendable vs Intrant** | Vendable = produit fini revendu aux clients. Intrant = matière première achetée mais non revendue (acier, cuivre, caoutchouc, etc.). |
| **Catégorie** | `nourriture`, `boisson`, `hygiene`, `materiel`, `matieres-premieres`. |
| **Alias** | Variantes de nom du produit pour faciliter le matching par le parser bot (ex: `cola` peut être appelé `coca`, `coca-cola`). |
| **fivemItemId** | ID interne FiveM du produit (souvent en `snake_case`, ex: `cola_zero`). Permet le mapping FiveM → site. |
| **seuilAlerte** | Stock minimum déclenchant un badge orange / alerte. |

---

## 📦 Termes catalogue craft (à venir)

Le LTD Sandy Shores a 8 produits **craftables** prévus (cf mémoire `projet_recettes_craft`) :
- Visseries
- Pioche
- Filet
- Jerrican
- Sac jute
- Plomberie
- Câble
- Lumière violette

Les recettes ne sont **pas encore implémentées** dans le code (v1.7.0). À ajouter dans une future version.

---

## 🚗 Termes carburant / stations

| Terme | Définition |
|---|---|
| **Bidon** | Unité de matière première qu'un pompiste utilise pour ravitailler une pompe. Quota hebdo défini par grade. |
| **Caoutchouc** | Autre matière première (utilisée pour les pneus ?). Quota hebdo aussi. |
| **Ravitaillement** | Action du pompiste : utiliser des bidons pour remplir une pompe. Logué via FaabHook → parser bot. |
| **Pompe** | Unité de distribution dans une station. Une station a plusieurs pompes (essence/gasoil/premium). |
| **Redistribution** | Enregistrement d'une vente carburant agrégée (multiple ventes IG → 1 doc `/redistributions`). |
| **Quota** | Objectif hebdomadaire (bidons + caoutchoucs) à atteindre pour qu'un pompiste touche son bonus. |
| **Score pompiste** | % d'atteinte des quotas (moyenne des deux). |

---

## 🔄 Cycle de vie d'un employé

1. **Création** : direction crée le compte via `/admin` (email + password initial + rôle)
2. **Activation** : `statut: 'actif'`, `compteEnFinance: true` si éligible salaire
3. **Travail** : déclare ses ventes/services, voit son espace perso
4. **Paie** : versée chaque lundi matin par le patron, soit en jeu, soit via Discord
5. **Suspension** : `statut: 'suspendu'` (pas supprimé, sauvegarde historique)
6. **Suppression** : doc `/users/{uid}` supprimé. ⚠ Snapshots `/paiesEstimees` survivent.

---

## 🆘 Quand utiliser quoi (cheatsheet patron)

| Action RP | Où aller |
|---|---|
| Voir le CA de la semaine | `/dashboard` ou Sheet onglet `📊 Dashboard` |
| Voir les ventes en cours | `/ventes` ou Sheet onglet `Ventes Semaine N (...)` |
| Voir les dépenses | `/comptabilite` ou Sheet onglet `Dépenses Semaine N (...)` |
| Voir une semaine passée | Sheet onglet `Semaine N (jj-jj mois aaaa)` |
| Classifier une dépense (déductible ?) | `/comptabilite` → bouton 🔄 sur la ligne |
| Verser les paies | En jeu (commande IG) — le bot remonte les logs |
| Cocher Versé sur /rh | `/rh` → sélectionner semaine clôturée → checkbox |
| Clôturer la semaine | `/comptabilite` → bouton 🔒 (lundi 00h-01h idéalement) |
| Ajouter un employé | `/admin` → Users → Ajouter |
| Voir mon vendeur Lucas | `/employee?asUser=<uid>` (mode debug direction) |
| Marquer une subvention IRS | `/admin` → tagger l'entrée banque |
| Ajouter une dette à rembourser | `/admin` → Engagements → Créer |
| Refresh le Sheet | `/comptabilite` → bouton 🔄 |
| Voir le guide d'utilisation | `/guide` (n'importe quelle page) |
