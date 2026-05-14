// ============================================================
// Refonte complète du Dashboard du Sheet Compta — visuel pro
// ============================================================
// Ce script lit les données depuis Firestore (source de vérité) et reconstruit
// entièrement l'onglet "📊 Dashboard" avec :
//   - Bandeau titre LTD Sandy Shores + sous-titre TTE + horodatage
//   - 6 KPIs couleur (CA, Charges dédu, Résultat imposable, Masse salariale,
//     Bénéfice net, Impôt estimé) en 2 lignes de 3
//   - Section Conformité TTE (4 indicateurs)
//   - 5 dernières ventes + 5 dernières dépenses côte à côte
//   - Historique des semaines clôturées (audit IRS)
//   - Footer "Détail dans onglets"
//
// Calculs côté Node.js depuis Firestore, donc toujours à jour
// (pas dépendant du cache IMPORTDATA de Sheets).
// ============================================================
// Usage : node scripts/refaire-dashboard-pro.js
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { google } from 'googleapis';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
const SHEET_ID = '1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY';
const DASHBOARD_NAME = '📊 Dashboard';

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

// ============================================================
// Couleurs LTD (palette western/saloon)
// ============================================================
const C = {
  blood:  { red: 0.545, green: 0,     blue: 0     }, // #8B0000 sang
  blood2: { red: 0.70,  green: 0.10,  blue: 0.10  }, // rouge plus clair
  bone:   { red: 0.961, green: 0.941, blue: 0.91  }, // #F5F0E8 ivoire
  bone2:  { red: 0.98,  green: 0.97,  blue: 0.95  }, // ivoire clair
  gold:   { red: 0.788, green: 0.663, blue: 0.380 }, // #c9a961 doré
  gold2:  { red: 0.92,  green: 0.85,  blue: 0.60  }, // doré clair
  green:  { red: 0.29,  green: 0.49,  blue: 0.18  }, // #4a7c2e
  greenL: { red: 0.85,  green: 0.95,  blue: 0.80  }, // vert clair
  orange: { red: 0.79,  green: 0.50,  blue: 0.10  }, // #c97f1a
  orangeL:{ red: 1.00,  green: 0.93,  blue: 0.78  }, // orange pâle
  blue:   { red: 0.29,  green: 0.42,  blue: 0.54  }, // #4a6b8a
  blueL:  { red: 0.85,  green: 0.90,  blue: 0.96  }, // bleu pâle
  red:    { red: 0.79,  green: 0.20,  blue: 0.20  },
  redL:   { red: 1.00,  green: 0.85,  blue: 0.82  },
  white:  { red: 1, green: 1, blue: 1 },
  black:  { red: 0, green: 0, blue: 0 },
  gray:   { red: 0.45, green: 0.45, blue: 0.45 },
  grayL:  { red: 0.92, green: 0.92, blue: 0.92 }
};

// ============================================================
// Helpers data
// ============================================================
function money(n) {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('fr-FR') + ' $';
}
function pct(num, den, fixed = 1) {
  if (!den) return '—';
  return ((num / den) * 100).toFixed(fixed) + ' %';
}

function startOfWeekRP() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfWeekRP() {
  const d = startOfWeekRP();
  d.setDate(d.getDate() + 7);
  d.setMilliseconds(-1);
  return d;
}

// Tranches d'imposition TTE Art. 4-3.2 (sur bénéfice)
function tranchesImpot(benefice) {
  if (benefice <= 10000)  return { tranche: 0, taux: 0,    montant: 0 };
  if (benefice <= 50000)  return { tranche: 1, taux: 0.10, montant: Math.round(benefice * 0.10) };
  if (benefice <= 100000) return { tranche: 2, taux: 0.19, montant: Math.round(benefice * 0.19) };
  if (benefice <= 250000) return { tranche: 3, taux: 0.28, montant: Math.round(benefice * 0.28) };
  if (benefice <= 500000) return { tranche: 4, taux: 0.36, montant: Math.round(benefice * 0.36) };
  return { tranche: 5, taux: 0.46, montant: Math.round(benefice * 0.46) };
}

// ============================================================
// Construction des données Dashboard
// ============================================================
async function chargerDonnees() {
  const debut = startOfWeekRP();
  const fin   = endOfWeekRP();

  // Ventes semaine
  const ventesSnap = await db.collection('ventes')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin))
    .orderBy('timestamp', 'desc')
    .get();
  const ventes = ventesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => !v.cachee);

  // Dépenses semaine (hors paies)
  const depSnap = await db.collection('depenses')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin))
    .orderBy('timestamp', 'desc')
    .get();
  const depensesAll = depSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const depenses = depensesAll.filter(d => d.type !== 'paie');

  // Paies semaine
  const paiesSnap = await db.collection('paies')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin))
    .orderBy('timestamp', 'desc')
    .get();
  const paies = paiesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Redistributions essence (CA carburant)
  const redisSnap = await db.collection('redistributions')
    .where('timestamp', '>=', Timestamp.fromDate(debut))
    .where('timestamp', '<=', Timestamp.fromDate(fin))
    .get();
  const redis = redisSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Semaines clôturées (historique)
  const semSnap = await db.collection('semaines')
    .orderBy('numero', 'desc')
    .limit(10)
    .get();
  const semaines = semSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Calculs
  const caProduits  = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const caCarburant = redis.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const caTotal     = caProduits + caCarburant;
  const totalDep    = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const chargesDedu = depenses.filter(d => d.deductible !== false).reduce((s, d) => s + (d.montant || 0), 0);
  const chargesNonDedu = totalDep - chargesDedu;
  const masseSalariale = paies.reduce((s, p) => s + (p.montant || 0), 0);
  const resultatImposable = caTotal - chargesDedu;
  const beneficeNet = caTotal - totalDep - masseSalariale;
  const impot = tranchesImpot(beneficeNet > 0 ? beneficeNet : 0);
  const ratioMasseSal = caTotal > 0 ? (masseSalariale / caTotal) : 0;

  return {
    debut, fin,
    ventes, depenses, depensesAll, paies, redis, semaines,
    caProduits, caCarburant, caTotal,
    totalDep, chargesDedu, chargesNonDedu,
    masseSalariale, ratioMasseSal,
    resultatImposable, beneficeNet, impot
  };
}

// ============================================================
// Construction des lignes du Dashboard (values + formats)
// ============================================================
function buildDashboard(data) {
  const {
    debut, fin, ventes, depenses, semaines,
    caProduits, caCarburant, caTotal,
    totalDep, chargesDedu, chargesNonDedu,
    masseSalariale, ratioMasseSal,
    resultatImposable, beneficeNet, impot
  } = data;

  const maintenant = new Date().toLocaleString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  const semainePeriode = `Semaine du ${debut.toLocaleDateString('fr-FR')} au ${fin.toLocaleDateString('fr-FR')}`;

  // Layout 9 colonnes (A-I). Largeur Dashboard ~1200px.
  // Chaque "row" : tableau de 9 cellules (string OU null).
  // null = cellule vide (fusionnable).

  const rows = [];

  // === BANDEAU TITRE === (rows 1-3)
  rows.push(['🤠 LTD SANDY SHORES — TABLEAU DE BORD COMPTABLE', null, null, null, null, null, null, null, null]); // 1
  rows.push(['Conforme TTE Chapitre IV — Secteur 2 (Services et biens indispensables)', null, null, null, null, null, null, null, null]); // 2
  rows.push([semainePeriode + '  •  Généré le ' + maintenant, null, null, null, null, null, null, null, null]); // 3
  rows.push(['', '', '', '', '', '', '', '', '']); // 4 spacer

  // === KPIs LIGNE 1 === (rows 5-7) — 3 KPIs sur 3 colonnes chacun
  rows.push([
    '💚 CA SEMAINE', null, null,
    '❤ CHARGES DÉDUCTIBLES', null, null,
    '📋 RÉSULTAT IMPOSABLE', null, null
  ]); // 5 labels
  rows.push([
    money(caTotal), null, null,
    money(chargesDedu), null, null,
    money(resultatImposable), null, null
  ]); // 6 valeurs
  rows.push([
    `${ventes.length} factures · CA produits ${money(caProduits)} · ⛽ ${money(caCarburant)}`, null, null,
    `${depenses.filter(d => d.deductible !== false).length}/${depenses.length} dépenses dédu · non-dédu ${money(chargesNonDedu)}`, null, null,
    `Base = (CA + Autres) − Charges dédu (Art. 4-2.4)`, null, null
  ]); // 7 détails
  rows.push(['', '', '', '', '', '', '', '', '']); // 8 spacer

  // === KPIs LIGNE 2 === (rows 9-11)
  const masseLabel = ratioMasseSal <= 0.90 ? '🟢 OK' : '🔴 HORS TTE';
  rows.push([
    '💰 MASSE SALARIALE', null, null,
    '🎯 BÉNÉFICE NET', null, null,
    '🏛 IMPÔT ESTIMÉ', null, null
  ]); // 9
  rows.push([
    money(masseSalariale), null, null,
    money(beneficeNet), null, null,
    money(impot.montant), null, null
  ]); // 10
  rows.push([
    `${pct(masseSalariale, caTotal)} du CA · seuil TTE 90 % · ${masseLabel}`, null, null,
    `Marge = ${pct(beneficeNet, caTotal)} · ${beneficeNet >= 0 ? 'positif' : '⚠ déficitaire'}`, null, null,
    `Tranche ${impot.tranche} · taux ${(impot.taux * 100).toFixed(0)} % (Art. 4-3.2)`, null, null
  ]); // 11
  rows.push(['', '', '', '', '', '', '', '', '']); // 12 spacer

  // === CONFORMITÉ TTE === (rows 13-18)
  rows.push(['📊 CONFORMITÉ TTE — Indicateurs clés', null, null, null, null, null, null, null, null]); // 13 (header section)

  const conformiteRows = [
    {
      label: 'Masse salariale ≤ 90 % du CA',
      ref:   'Art. 4-1.13',
      ok:    ratioMasseSal <= 0.90,
      detail: `Actuel : ${pct(masseSalariale, caTotal)}`
    },
    {
      label: 'Comptabilité tenue et conservée min 6 sem',
      ref:   'Art. 4-1.1',
      ok:    true,
      detail: 'Conservation 100 % historique activée'
    },
    {
      label: 'Justificatifs par dépense (audit IRS)',
      ref:   'Art. 4-1.5',
      ok:    depenses.every(d => d.raison && d.raison.length > 0),
      detail: `${depenses.filter(d => d.raison).length}/${depenses.length} dépenses avec justification`
    },
    {
      label: 'Déclaration fiscale avant mardi 21h',
      ref:   'Art. 4-3.3',
      ok:    true,
      detail: 'À soumettre via comptaExport — deadline mardi 21h'
    }
  ];
  for (const c of conformiteRows) {
    rows.push([
      c.ok ? '🟢' : '🔴', c.label, null, null,
      c.ref, null,
      c.detail, null, null
    ]);
  }
  rows.push(['', '', '', '', '', '', '', '', '']); // spacer

  // === 5 DERNIÈRES VENTES + 5 DERNIÈRES DÉPENSES === (côte à côte)
  rows.push(['💵 5 DERNIÈRES VENTES', null, null, null, '💸 5 DERNIÈRES DÉPENSES', null, null, null, null]); // header
  rows.push(['Date', 'Vendeur', 'Montant', null, 'Date', 'Raison', 'Montant', 'Type', null]); // sub-header

  const ventesSlice   = ventes.slice(0, 5);
  const depensesSlice = depenses.slice(0, 5);
  const maxRows = Math.max(ventesSlice.length, depensesSlice.length, 1);
  for (let i = 0; i < maxRows; i++) {
    const v = ventesSlice[i];
    const d = depensesSlice[i];
    rows.push([
      v ? v.timestamp?.toDate?.()?.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) || '' : '',
      v ? (v.vendeurNom || '—') : '',
      v ? money(v.montant) : '',
      null,
      d ? d.timestamp?.toDate?.()?.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) || '' : '',
      d ? (d.raison || '—').slice(0, 35) : '',
      d ? money(d.montant) : '',
      d ? (d.type || '') : '',
      null
    ]);
  }
  rows.push(['', '', '', '', '', '', '', '', '']);

  // === HISTORIQUE SEMAINES ===
  rows.push(['📚 HISTORIQUE DES SEMAINES — Audit IRS', null, null, null, null, null, null, null, null]);
  rows.push(['Semaine', 'Date début', 'Date fin', 'CA', 'Dépenses', 'Masse salariale', 'Bénéfice net', 'Statut', null]);
  if (semaines.length === 0) {
    rows.push(['—', 'Aucune semaine clôturée pour le moment', null, null, null, null, null, null, null]);
  } else {
    for (const s of semaines) {
      rows.push([
        String(s.numero || s.id || ''),
        s.dateDebut ? new Date(s.dateDebut).toLocaleDateString('fr-FR') : '',
        s.dateFin   ? new Date(s.dateFin).toLocaleDateString('fr-FR')   : '',
        money(s.ca || 0),
        money(s.depensesTotales || s.depenses || 0),
        money(s.masseSalariale || 0),
        money(s.beneficeNet || 0),
        s.statut || 'cloturee',
        null
      ]);
    }
  }
  rows.push(['', '', '', '', '', '', '', '', '']);

  // === FOOTER AUDIT IRS (compact) ===
  rows.push(['🔎 Audit IRS — Détail dans onglets :  📁 Depenses  ·  📁 Ventes  ·  📁 Paies  ·  📁 resumé', null, null, null, null, null, null, null, null]);
  rows.push(['Dashboard généré depuis Firestore (source de vérité). Onglets sources : IMPORTDATA (refresh ~1h).', null, null, null, null, null, null, null, null]);

  return rows;
}

// ============================================================
// Construction des requêtes batchUpdate pour formatage
// ============================================================
function buildFormatRequests(sheetId, rows) {
  const reqs = [];
  const nbRows = rows.length;
  const nbCols = 9;

  // Reset général : tout en background blanc
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: nbRows, startColumnIndex: 0, endColumnIndex: nbCols },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.white,
          textFormat: { foregroundColor: C.black, fontSize: 10, bold: false },
          verticalAlignment: 'MIDDLE',
          wrapStrategy: 'WRAP'
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)'
    }
  });

  // === BANDEAU TITRE (rows 0-2) ===
  // Ligne 0 : titre principal, fusion 9 cols, fond rouge sang + texte ivoire bold gros
  reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 9 },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.blood,
          textFormat: { foregroundColor: C.bone, bold: true, fontSize: 18, fontFamily: 'Georgia' },
          horizontalAlignment: 'CENTER',
          verticalAlignment: 'MIDDLE',
          padding: { top: 12, bottom: 12, left: 8, right: 8 }
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)'
    }
  });
  // Ligne 1 : sous-titre
  reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 9 },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.blood2,
          textFormat: { foregroundColor: C.bone, italic: true, fontSize: 11 },
          horizontalAlignment: 'CENTER',
          padding: { top: 4, bottom: 4, left: 8, right: 8 }
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
    }
  });
  // Ligne 2 : horodatage
  reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 9 },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.gold,
          textFormat: { foregroundColor: C.black, fontSize: 10 },
          horizontalAlignment: 'CENTER',
          padding: { top: 3, bottom: 3, left: 8, right: 8 }
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
    }
  });

  // === KPIs LIGNE 1 (rows 4-6) ===
  // Fusion 3 cols x 3 KPIs
  const kpiBlocks = [
    { col0: 0, color: C.greenL,  borderColor: C.green  }, // CA
    { col0: 3, color: C.redL,    borderColor: C.red    }, // Charges dédu
    { col0: 6, color: C.bone2,   borderColor: C.gold   }  // Résultat imposable
  ];
  for (const blk of kpiBlocks) {
    // Label (row 4)
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 },
        cell: {
          userEnteredFormat: {
            backgroundColor: blk.borderColor,
            textFormat: { foregroundColor: C.white, bold: true, fontSize: 11 },
            horizontalAlignment: 'CENTER',
            padding: { top: 6, bottom: 6 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
    // Valeur (row 5)
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 5, endRowIndex: 6, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 5, endRowIndex: 6, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 },
        cell: {
          userEnteredFormat: {
            backgroundColor: blk.color,
            textFormat: { foregroundColor: C.black, bold: true, fontSize: 22, fontFamily: 'Georgia' },
            horizontalAlignment: 'CENTER',
            padding: { top: 14, bottom: 14 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
    // Détail (row 6)
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 },
        cell: {
          userEnteredFormat: {
            backgroundColor: blk.color,
            textFormat: { foregroundColor: C.gray, fontSize: 9, italic: true },
            horizontalAlignment: 'CENTER',
            padding: { top: 3, bottom: 6 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
  }

  // === KPIs LIGNE 2 (rows 8-10) ===
  const kpiBlocks2 = [
    { col0: 0, color: C.orangeL, borderColor: C.orange }, // Masse salariale
    { col0: 3, color: C.blueL,   borderColor: C.blue   }, // Bénéfice net
    { col0: 6, color: C.gold2,   borderColor: C.gold   }  // Impôt estimé
  ];
  for (const blk of kpiBlocks2) {
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 8, endRowIndex: 9, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 8, endRowIndex: 9, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 },
        cell: {
          userEnteredFormat: {
            backgroundColor: blk.borderColor,
            textFormat: { foregroundColor: C.white, bold: true, fontSize: 11 },
            horizontalAlignment: 'CENTER',
            padding: { top: 6, bottom: 6 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 9, endRowIndex: 10, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 9, endRowIndex: 10, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 },
        cell: {
          userEnteredFormat: {
            backgroundColor: blk.color,
            textFormat: { foregroundColor: C.black, bold: true, fontSize: 22, fontFamily: 'Georgia' },
            horizontalAlignment: 'CENTER',
            padding: { top: 14, bottom: 14 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 10, endRowIndex: 11, startColumnIndex: blk.col0, endColumnIndex: blk.col0 + 3 },
        cell: {
          userEnteredFormat: {
            backgroundColor: blk.color,
            textFormat: { foregroundColor: C.gray, fontSize: 9, italic: true },
            horizontalAlignment: 'CENTER',
            padding: { top: 3, bottom: 6 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
  }

  // === Section "CONFORMITÉ TTE" — header (row 12)
  reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 12, endRowIndex: 13, startColumnIndex: 0, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 12, endRowIndex: 13, startColumnIndex: 0, endColumnIndex: 9 },
      cell: {
        userEnteredFormat: {
          backgroundColor: C.gold,
          textFormat: { foregroundColor: C.black, bold: true, fontSize: 12 },
          horizontalAlignment: 'LEFT',
          padding: { top: 6, bottom: 6, left: 10 }
        }
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
    }
  });

  // 4 lignes conformité (rows 13-16) : fusion par sections
  for (let r = 13; r <= 16; r++) {
    // Col A = icône
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', textFormat: { fontSize: 14 } } },
        fields: 'userEnteredFormat(horizontalAlignment,textFormat)'
      }
    });
    // Cols B-D = label (fusion)
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 1, endColumnIndex: 4 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 1, endColumnIndex: 4 },
        cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 10 }, padding: { left: 4 } } },
        fields: 'userEnteredFormat(textFormat,padding)'
      }
    });
    // Cols E-F = ref article (fusion)
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 4, endColumnIndex: 6 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 4, endColumnIndex: 6 },
        cell: { userEnteredFormat: { horizontalAlignment: 'CENTER', textFormat: { fontSize: 9, italic: true, foregroundColor: C.gray } } },
        fields: 'userEnteredFormat(horizontalAlignment,textFormat)'
      }
    });
    // Cols G-I = détail (fusion)
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 6, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 6, endColumnIndex: 9 },
        cell: { userEnteredFormat: { textFormat: { fontSize: 9, foregroundColor: C.gray }, padding: { right: 8 } } },
        fields: 'userEnteredFormat(textFormat,padding)'
      }
    });
    // Bordure basse fine
    reqs.push({
      updateBorders: {
        range: { sheetId, startRowIndex: r, endRowIndex: r + 1, startColumnIndex: 0, endColumnIndex: 9 },
        bottom: { style: 'SOLID', width: 1, color: C.grayL }
      }
    });
  }

  // === 5 dernières ventes/dépenses === ligne header (row 18)
  // Section "VENTES" : cols 0-3, section "DÉPENSES" : cols 4-8
  reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 18, endRowIndex: 19, startColumnIndex: 0, endColumnIndex: 4 }, mergeType: 'MERGE_ALL' } });
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 18, endRowIndex: 19, startColumnIndex: 0, endColumnIndex: 4 },
      cell: { userEnteredFormat: { backgroundColor: C.green, textFormat: { foregroundColor: C.white, bold: true, fontSize: 11 }, horizontalAlignment: 'CENTER', padding: { top: 6, bottom: 6 } } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
    }
  });
  reqs.push({ mergeCells: { range: { sheetId, startRowIndex: 18, endRowIndex: 19, startColumnIndex: 4, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 18, endRowIndex: 19, startColumnIndex: 4, endColumnIndex: 9 },
      cell: { userEnteredFormat: { backgroundColor: C.red, textFormat: { foregroundColor: C.white, bold: true, fontSize: 11 }, horizontalAlignment: 'CENTER', padding: { top: 6, bottom: 6 } } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
    }
  });
  // Sub-header (row 19)
  reqs.push({
    repeatCell: {
      range: { sheetId, startRowIndex: 19, endRowIndex: 20, startColumnIndex: 0, endColumnIndex: 9 },
      cell: { userEnteredFormat: { backgroundColor: C.grayL, textFormat: { bold: true, fontSize: 9 }, horizontalAlignment: 'CENTER', padding: { top: 3, bottom: 3 } } },
      fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
    }
  });

  // Header section historique
  const lastRow = rows.length;
  // Trouve la ligne de "📚 HISTORIQUE..."
  const idxHistorique = rows.findIndex(r => String(r[0]).includes('📚 HISTORIQUE'));
  if (idxHistorique >= 0) {
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: idxHistorique, endRowIndex: idxHistorique + 1, startColumnIndex: 0, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: idxHistorique, endRowIndex: idxHistorique + 1, startColumnIndex: 0, endColumnIndex: 9 },
        cell: { userEnteredFormat: { backgroundColor: C.gold, textFormat: { foregroundColor: C.black, bold: true, fontSize: 12 }, horizontalAlignment: 'LEFT', padding: { top: 6, bottom: 6, left: 10 } } },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
    // Sub-header historique
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: idxHistorique + 1, endRowIndex: idxHistorique + 2, startColumnIndex: 0, endColumnIndex: 9 },
        cell: { userEnteredFormat: { backgroundColor: C.grayL, textFormat: { bold: true, fontSize: 9 }, horizontalAlignment: 'CENTER', padding: { top: 3, bottom: 3 } } },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
  }

  // Footer AUDIT IRS (compact, 2 lignes discrètes)
  const idxAudit = rows.findIndex(r => String(r[0]).includes('🔎 Audit IRS'));
  if (idxAudit >= 0) {
    // Ligne 1 : liste des onglets — fond gris clair, texte gris foncé, petite police
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: idxAudit, endRowIndex: idxAudit + 1, startColumnIndex: 0, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: idxAudit, endRowIndex: idxAudit + 1, startColumnIndex: 0, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            backgroundColor: C.grayL,
            textFormat: { foregroundColor: C.gray, bold: false, fontSize: 9 },
            horizontalAlignment: 'CENTER',
            padding: { top: 3, bottom: 3 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
    // Ligne 2 : note technique — encore plus discret
    reqs.push({ mergeCells: { range: { sheetId, startRowIndex: idxAudit + 1, endRowIndex: idxAudit + 2, startColumnIndex: 0, endColumnIndex: 9 }, mergeType: 'MERGE_ALL' } });
    reqs.push({
      repeatCell: {
        range: { sheetId, startRowIndex: idxAudit + 1, endRowIndex: idxAudit + 2, startColumnIndex: 0, endColumnIndex: 9 },
        cell: {
          userEnteredFormat: {
            backgroundColor: C.white,
            textFormat: { foregroundColor: C.gray, fontSize: 8, italic: true },
            horizontalAlignment: 'CENTER',
            padding: { top: 2, bottom: 2 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,padding)'
      }
    });
  }

  // Hauteurs de lignes
  // Titre principal grand
  reqs.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 50 }, fields: 'pixelSize' } });
  // KPI valeurs grandes (rows 5, 9)
  reqs.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 5, endIndex: 6 }, properties: { pixelSize: 60 }, fields: 'pixelSize' } });
  reqs.push({ updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 9, endIndex: 10 }, properties: { pixelSize: 60 }, fields: 'pixelSize' } });

  // Largeurs de colonnes
  for (let c = 0; c < nbCols; c++) {
    reqs.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
        properties: { pixelSize: 130 },
        fields: 'pixelSize'
      }
    });
  }

  // Pas de quadrillage Google par défaut
  reqs.push({
    updateSheetProperties: {
      properties: { sheetId, gridProperties: { hideGridlines: true } },
      fields: 'gridProperties.hideGridlines'
    }
  });

  return reqs;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('1. Chargement des données Firestore...');
  const data = await chargerDonnees();
  console.log(`   ${data.ventes.length} ventes, ${data.depenses.length} dépenses, ${data.paies.length} paies, ${data.semaines.length} semaines clôturées`);
  console.log(`   CA ${money(data.caTotal)} · Charges dédu ${money(data.chargesDedu)} · Bénéfice ${money(data.beneficeNet)} · Impôt ${money(data.impot.montant)}`);

  console.log('\n2. Construction du Dashboard...');
  const rows = buildDashboard(data);
  console.log(`   ${rows.length} lignes`);

  console.log('\n3. Localisation de l\'onglet Dashboard...');
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, includeGridData: false });
  const ong = (meta.data.sheets || []).find(s => s.properties.title === DASHBOARD_NAME);
  if (!ong) throw new Error(`Onglet "${DASHBOARD_NAME}" introuvable`);
  const sheetId = ong.properties.sheetId;

  console.log('\n4. Effacement contenu et fusions existantes...');
  // Unmerge tout d'abord
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        { unmergeCells: { range: { sheetId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 26 } } },
        { updateCells: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 26 },
            fields: 'userEnteredValue,userEnteredFormat'
        } }
      ]
    }
  });

  console.log('\n5. Écriture des valeurs...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${DASHBOARD_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows.map(r => r.map(c => c == null ? '' : c)) }
  });

  console.log('\n6. Application des formats (fusions, couleurs, polices)...');
  const formatReqs = buildFormatRequests(sheetId, rows);
  // Split en batches pour éviter le 1MB limit
  const BATCH = 30;
  for (let i = 0; i < formatReqs.length; i += BATCH) {
    const slice = formatReqs.slice(i, i + BATCH);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: slice }
    });
    process.stdout.write(`   ${Math.min(i + BATCH, formatReqs.length)}/${formatReqs.length}\r`);
  }
  console.log(`   ✓ ${formatReqs.length} requests appliquées`);

  console.log('\n✓ Dashboard refait. F5 ton Sheet pour voir le rendu pro.');
  process.exit(0);
}

main().catch(e => { console.error('Erreur :', e.message); console.error(e.stack); process.exit(2); });
