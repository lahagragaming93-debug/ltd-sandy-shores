# 🔗 Liens utiles — LTD Sandy Shores

> Tous les liens à mettre en favoris. À garder ouvert dans un onglet ou à transmettre au vrai patron.

---

## 🌵 Quotidien — Site web

| Quoi | URL |
|------|-----|
| 🏠 **Accueil / Connexion** | https://lahagragaming93-debug.github.io/ltd-sandy-shores/ |
| 📊 Dashboard | https://lahagragaming93-debug.github.io/ltd-sandy-shores/dashboard.html |
| 🛒 Stocks épicerie | https://lahagragaming93-debug.github.io/ltd-sandy-shores/stocks.html |
| ⛽ Stations essence | https://lahagragaming93-debug.github.io/ltd-sandy-shores/stations.html |
| 💵 Ventes | https://lahagragaming93-debug.github.io/ltd-sandy-shores/ventes.html |
| 📋 Comptabilité | https://lahagragaming93-debug.github.io/ltd-sandy-shores/comptabilite.html |
| 🧑‍💼 Ressources humaines | https://lahagragaming93-debug.github.io/ltd-sandy-shores/rh.html |
| ⚙ Administration | https://lahagragaming93-debug.github.io/ltd-sandy-shores/admin.html |
| 📖 Guide intégré (tutoriel) | https://lahagragaming93-debug.github.io/ltd-sandy-shores/guide.html |
| 👤 Mon espace | https://lahagragaming93-debug.github.io/ltd-sandy-shores/employee.html |
| 💰 Mes paies | https://lahagragaming93-debug.github.io/ltd-sandy-shores/paies.html |

---

## 📊 Compta Google Sheets temps réel

| Quoi | URL |
|------|-----|
| 🆕 Créer un Sheet vierge | https://sheets.new |
| ⚙ Bouton « Export Google Sheets » | dans Admin → en haut |
| 🔑 Token compta export | `eddd7ef237c1386bb41981583df6eb94baa95379e5268c123b733fca4d833ad4` |

> 📝 **Procédure setup** : Admin → « 📊 Export Google Sheets » → colle le token → Sauvegarder → copie les 4 formules dans 4 onglets de ton Sheet (`Résumé`, `Dépenses`, `Ventes`, `Paies`).

---

## 📚 Documentation par rôle (lecture sur GitHub)

| Pour qui | Lien |
|----------|------|
| 📋 Sommaire général | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/public/guide/00-index.md |
| 👑 Patron / Co-Patron | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/public/guide/01-direction.md |
| 📋 DRH | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/public/guide/02-drh.md |
| 🛒 Responsable Vente | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/public/guide/03-responsable-vente.md |
| ⛽ Responsable Pompiste | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/public/guide/04-responsable-pompiste.md |
| 💵 Vendeur | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/public/guide/05-vendeur.md |
| 🚗 Pompiste | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/public/guide/06-pompiste.md |
| 🤖 Automatismes (bot, clôture, alertes) | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/public/guide/07-automatismes.md |
| ❓ FAQ + Dépannage | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/public/guide/08-faq-depannage.md |
| 📖 Journal de bord | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/docs/JOURNAL.md |
| 🤝 Procédure de transmission | https://github.com/lahagragaming93-debug/ltd-sandy-shores/blob/main/docs/07-transmission.md |

---

## 🔧 Technique / Admin (toi en tant qu'intendant)

| Quoi | URL |
|------|-----|
| 📦 **Code source GitHub** | https://github.com/lahagragaming93-debug/ltd-sandy-shores |
| 🚀 Déploiements GitHub Actions | https://github.com/lahagragaming93-debug/ltd-sandy-shores/actions |
| 🔥 **Console Firebase** | https://console.firebase.google.com/project/ltd-sandy-shores-f3919 |
| 🔐 Authentication (mots de passe) | https://console.firebase.google.com/project/ltd-sandy-shores-f3919/authentication/users |
| 📦 Firestore Database | https://console.firebase.google.com/project/ltd-sandy-shores-f3919/firestore |
| ⚙ Cloud Functions (logs) | https://console.firebase.google.com/project/ltd-sandy-shores-f3919/functions |
| 🔑 Secrets Manager | https://console.firebase.google.com/project/ltd-sandy-shores-f3919/functions/secrets |
| 💰 Billing GCP | https://console.cloud.google.com/billing/linkedaccount?project=ltd-sandy-shores-f3919 |
| 🚂 Railway (bot Discord) | https://railway.com |

---

## 🆘 Statut services externes (en cas de panne)

| Service | URL statut |
|---------|------------|
| GitHub Pages | https://www.githubstatus.com/ |
| Firebase | https://status.firebase.google.com/ |
| Railway | https://railway.statuspage.io/ |
| Discord | https://discordstatus.com/ |

---

## 📞 Comptes & Identités

| Élément | Valeur |
|---------|--------|
| 🏢 Project ID Firebase | `ltd-sandy-shores-f3919` |
| 📧 Compte Google Firebase | `lahagragaming93@gmail.com` |
| 🐙 Compte GitHub | `lahagragaming93-debug` |
| 👑 Patron RP (vrai) | Maxime BLAKE — `maximegreaume@gmail.com` |
| 🛠 Intendant temporaire | Andrew BEAUCHAMP / boulalahagra — `lahagragaming93@gmail.com` |
| 🤖 Bot Discord | LTD Sandy Shores Bot#0243 |

---

## ⚙ Cloud Functions déployées

| Fonction | URL |
|----------|-----|
| `botIngest` (HTTP, bot Discord) | `https://botingest-tzkzzt4ckq-ew.a.run.app` |
| `comptaExport` (HTTP, Sheets) | `https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/comptaExport` |
| `clotureHebdo` (cron lundi 00h00 Europe/Paris) | scheduler interne |
| `alerteStock`, `alerteStation`, `alerteVenteSansStock` | triggers Firestore |

---

> 💡 **Conseil** : crée un dossier favoris « LTD Sandy Shores » dans ton navigateur avec les liens de la section « Quotidien » + le Sheet de compta + Firebase Console. Pour la transmission au vrai patron, exporte ce dossier en HTML.
