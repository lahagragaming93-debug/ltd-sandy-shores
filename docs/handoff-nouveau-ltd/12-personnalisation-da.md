# 12 — Personnalisation de la DA (rebrand visuel + naming)

> Comment adapter le squelette à un nouveau LTD avec sa propre identité visuelle.

---

## 🎨 Niveau d'ambition à choisir avec le user

### Niveau 1 — Rebrand léger (~1h)
Garder le thème western, juste changer :
- Logo + favicon
- Nom du LTD partout
- Signature (BLATV → ton nom)
- Couleurs accents (palette western mais teintes ajustées)

→ Idéal si le nouveau LTD est aussi RP "western" / "campagne".

### Niveau 2 — Refonte thème (~3-4h)
Garder l'architecture mais changer l'univers visuel :
- Nouvelle palette (ex: mafia → noir/rouge/or ; cyberpunk → néon ; corporate → bleu/gris)
- Nouvelle typo (Georgia → autre serif ou sans-serif)
- Adapter les émojis (🤠 → 🎰 / 🏙 / 🌃 selon univers)
- Refonte `western.css` (1899 lignes à adapter)

→ Idéal si le LTD est sur un autre univers RP que Sandy Shores.

### Niveau 3 — Refonte complète (~6-10h)
Tout repenser : layout, composants, icônes custom.
→ Hors scope de ce handoff. À considérer si vraiment un autre produit.

---

## 📋 Fichiers à modifier (par priorité)

### Tier 1 — Indispensable (rebrand minimum)

| Fichier | Quoi changer | Sandy Shores → Nouveau |
|---|---|---|
| `public/img/logo.png` | Image logo | À refaire dans Photoshop/Figma/Canva |
| `public/img/favicon.png` | Favicon onglet (32×32 ou 64×64) | À refaire |
| `public/js/version.js` | `VERSION` + `AUTHOR` | `1.7.0 BLATV` → `1.0.0 TonNom` |
| `README.md` | Nom + description projet | "LTD Sandy Shores" → "LTD [Nom]" |
| `public/js/layout.js` | Nom affiché sidebar | "🤠 SANDY SHORES" → "🎰 LE CASINO" (par ex) |

### Tier 2 — Important (cohérence textuelle)

| Fichier | Quoi changer |
|---|---|
| `public/index.html` + tous les `.html` | `<title>` et `<meta description>` |
| Tous les `public/guide/*.md` | Mentions "Sandy Shores", noms employés exemples (Blake MARS, etc.), termes RP spécifiques |
| `public/css/western.css` | Palette couleurs (variables CSS en début de fichier) |
| `firebase/functions/lib/dashboard-core.mjs` | Titre bandeau Dashboard (`🤠 LTD SANDY SHORES — TABLEAU DE BORD COMPTABLE`) |
| `firebase/functions/lib/snapshot-sheet-semaine.mjs` | Titre bandeau snapshot (`🤠 Semaine 20 ... — LTD SANDY SHORES`) |

### Tier 3 — Optionnel (polish)

| Fichier | Quoi changer |
|---|---|
| Émojis dans le code | `🤠` → autre selon univers (`🎰`, `🌃`, etc.) |
| Termes RP | "Sandy Shores RPG" / "FaabHook" → noms du nouveau serveur |
| Footer micro-copy | "by BLATV" → ta signature |

---

## 🎨 Palette western actuelle (référence)

```css
/* public/css/western.css — variables principales en début de fichier */
:root {
  --color-blood:       #8B0000;   /* rouge sang : titres, headers, alertes */
  --color-blood-light: #B22222;   /* rouge plus clair */
  --color-bone:        #F5F0E8;   /* ivoire : fond principal, texte titres */
  --color-bone-light:  #FAF5EF;   /* ivoire clair : zebras tables */
  --color-gold:        #C9A961;   /* doré : badges, accents */
  --color-gold-light:  #E6C97A;   /* doré clair : hover */
  --color-green:       #4A7C2E;   /* vert : succès, CA */
  --color-green-light: #C8E0B0;   /* vert pâle : KPI cards */
  --color-orange:      #C97F1A;   /* orange : warnings */
  --color-orange-light:#FFEEC4;   /* orange pâle : badges */
  --color-blue:        #4A6B8A;   /* bleu : info, bénéfice */
  --color-blue-light:  #D9E5F0;   /* bleu pâle : KPI cards */
  --color-red:         #CA3838;   /* rouge : erreurs, déficit */
  --color-red-light:   #FFD9D2;   /* rouge pâle : KPI cards */
  --color-gray:        #737373;   /* gris : texte secondaire */
  --color-gray-light:  #EBEBEB;   /* gris pâle : bordures */
  --color-black:       #000000;
  --color-white:       #FFFFFF;
}
```

→ Pour rebrand léger : modifier 2-4 variables (ex: `--color-blood` et `--color-gold`).

---

## 🎨 Exemples de palettes alternatives

### Mafia / Casino
```css
:root {
  --color-blood:       #1A1A1A;   /* noir profond : titres */
  --color-bone:        #F4E4BC;   /* champagne : fond */
  --color-gold:        #D4AF37;   /* or vif : accents */
  --color-green:       #0F4C3A;   /* vert tapis casino */
  --color-blue:        #2C3E50;   /* bleu nuit */
  --color-red:         #8B0000;   /* rouge profond */
}
```

### Cyberpunk / Futuriste
```css
:root {
  --color-blood:       #FF0080;   /* magenta néon */
  --color-bone:        #0A0E27;   /* navy très foncé : fond */
  --color-gold:        #00F5FF;   /* cyan néon : accents */
  --color-green:       #00FF87;   /* vert néon */
  --color-blue:        #4A00E0;   /* violet électrique */
  --color-red:         #FF3366;   /* rose vif : erreurs */
}
```

### Corporate / Sobre
```css
:root {
  --color-blood:       #1E3A5F;   /* bleu marine : titres */
  --color-bone:        #FFFFFF;   /* blanc : fond */
  --color-gold:        #C9A961;   /* doré discret : accents */
  --color-green:       #2E7D32;   /* vert business */
  --color-blue:        #1976D2;   /* bleu corporate */
  --color-red:         #C62828;   /* rouge alerte */
}
```

→ Adapter `western.css` en mettant à jour les variables `:root`. La plupart des composants utilisent ces variables donc ça propagera.

---

## 🔍 Commandes utiles pour le rebrand

### Trouver toutes les occurrences à remplacer

```bash
# Nom Sandy Shores (toutes variantes)
grep -rln "Sandy Shores" public/ firebase/ docs/ README.md
grep -rln "SANDY SHORES" public/ firebase/ docs/ README.md
grep -rln "sandy-shores" public/ firebase/ docs/ README.md

# Signature
grep -rln "BLATV" public/ docs/ README.md

# Émojis western
grep -rln "🤠" public/ firebase/ docs/

# Project ID Firebase
grep -rln "ltd-sandy-shores-f3919" .

# SHEET_ID
grep -rln "1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY" .
```

### Remplacement bulk (avec sed sur Linux/Mac/Git Bash)

```bash
# Sandy Shores → Le Casino (exemple)
find . -type f \( -name "*.md" -o -name "*.html" -o -name "*.js" -o -name "*.mjs" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" \
  -exec sed -i 's/Sandy Shores/Le Casino/g' {} +

# Vérifier le résultat
grep -rln "Sandy Shores" public/ firebase/ docs/
# (Doit être vide)
```

⚠ Faire un commit avant le bulk replace, pour pouvoir revert si problème.

### Sur PowerShell Windows

```powershell
Get-ChildItem -Recurse -Include *.md,*.html,*.js,*.mjs -Exclude node_modules |
  ForEach-Object { (Get-Content $_.FullName) -replace 'Sandy Shores','Le Casino' | Set-Content $_.FullName }
```

---

## 🖼 Création du logo

### Spec
- Format **PNG** transparent (fond transparent)
- Taille recommandée : **256×256** ou **512×512** (sera redimensionné par CSS)
- Style cohérent avec la DA (western = silhouette cowboy / cactus, mafia = couronne / dés, etc.)

### Outils gratuits
- **Canva** : templates de logos LTD
- **Figma** : si tu sais designer
- **DALL-E / Midjourney** : génération AI (prompts type "logo flat design [thème] [nom LTD] minimaliste")
- **Adobe Express** : alternative Canva

### Favicon

- Format PNG 32×32 ou 64×64 (ou ICO multi-tailles)
- Souvent une version simplifiée du logo (silhouette uniquement)

---

## ✏ Refonte du naming RP

### Termes à adapter

| Sandy Shores | Nouveau (à définir avec user) |
|---|---|
| LTD Sandy Shores | LTD [Nom] |
| Blake MARS | [Nom patron RP] |
| Luciana ANGEL MARS | [Nom co-patron RP] |
| Broas NESQUIK | [Nom DRH RP] |
| Sandy Shores Gaz | [Nom station 1] |
| FaabHook | [Mod logs si différent] |
| Yootool | [Fournisseur si différent] |
| Fournisseur LTD | [Idem] |
| HDM (Heavy Duty Motors) | [Concessionnaire véhicule] |
| Dynasty 8 | [Magasin déco] |

### Fichiers où ces termes apparaissent
- `public/guide/*.md` (beaucoup d'exemples nominatifs)
- `docs/JOURNAL.md` (historique sessions, peut rester car ce sont des références passées)
- `firebase/functions/scripts/init-fournisseurs-mapping.js`
- Commentaires dans `firebase/functions/index.js`

---

## 🌐 Adapter à un autre serveur RP

Si le LTD n'est pas sur Sandy Shores RPG :

- [ ] Lire le **TTE du serveur cible** et le placer dans `docs/TTE-complet.txt`
- [ ] Mettre à jour `public/guide/10-tte-reference.md`
- [ ] Adapter les plafonds / tranches dans le code (cf `10-tte-rules.md`)
- [ ] Adapter les jours/heures du workflow clôture (cron schedule)
- [ ] Adapter les patterns FaabHook si le mod est différent (parsers bot)

---

## ✅ Checklist rebrand

Avant de considérer le rebrand terminé :

- [ ] Logo + favicon remplacés et visibles sur le site
- [ ] Nom LTD à jour dans la sidebar + footer + titre onglet
- [ ] Version réinitialisée à `1.0.0` + signature à ton nom
- [ ] Palette CSS appliquée (si rebrand niveau 2+)
- [ ] Aucune occurrence de "Sandy Shores" / "BLATV" résiduelle (vérif `grep`)
- [ ] Dashboard Sheet titre à jour
- [ ] Onglets snapshot futurs auront le bon titre
- [ ] Guides employés (`/guide`) mentionnent le bon LTD
- [ ] README à jour
- [ ] Commit clean avec message `Rebrand LTD [Nom] v1.0.0`
