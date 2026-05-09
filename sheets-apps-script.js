/**
 * ============================================================
 * LTD Sandy Shores — Mise en forme automatique du Sheet Compta
 * ============================================================
 *
 * Installation (5 min, à faire UNE FOIS) :
 *  1. Ouvre ton Sheet : https://docs.google.com/spreadsheets/d/1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY/edit
 *  2. Menu  Extensions  →  Apps Script
 *  3. Efface tout le code par défaut, colle TOUT ce fichier à la place
 *  4. Sauvegarde (Ctrl+S) — donne un nom au projet (ex. "LTD Sandy Shores Format")
 *  5. Bouton ▶ "Exécuter" (sélectionne la fonction "formaterEtDashboard")
 *  6. Autorise les permissions Google demandées (lecture/écriture du Sheet)
 *  7. C'est fait : le Sheet est formaté + un onglet Dashboard apparaît
 *
 * Le script se relance automatiquement à chaque ouverture du Sheet.
 * Pour relancer manuellement : menu "🤠 LTD" (en haut) → "Reformater tout".
 * ============================================================ */

// === Couleurs LTD (palette western) ===
const COLOR_BLOOD       = '#8B0000';
const COLOR_BLOOD_LIGHT = '#b81b1b';
const COLOR_SAND        = '#D2B48C';
const COLOR_SAND_LIGHT  = '#e6d3b3';
const COLOR_BONE        = '#F5F0E8';
const COLOR_GOLD        = '#c9a961';
const COLOR_DARK        = '#1a1a1a';
const COLOR_SUCCESS     = '#4a7c2e';
const COLOR_WARNING     = '#c97f1a';
const COLOR_DANGER      = '#a02020';
const COLOR_INFO        = '#4a6b8a';

// ============================================================
// MENU CUSTOM (apparaît dans la barre du Sheet)
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🤠 LTD')
    .addItem('🎨 Reformater tout', 'formaterEtDashboard')
    .addItem('📊 Recréer le Dashboard', 'creerDashboard')
    .addSeparator()
    .addItem('🔄 Forcer refresh IMPORTDATA', 'forcerRefresh')
    .addToUi();

  // Auto-format léger à chaque ouverture (juste les en-têtes)
  try { formaterEntetes(); } catch (e) { /* ignore */ }
}

// ============================================================
// FONCTION PRINCIPALE — à lancer 1 fois après installation
// ============================================================
function formaterEtDashboard() {
  formaterOnglet('Résumé',   styleResume);
  formaterOnglet('Dépenses', styleDepenses);
  formaterOnglet('Ventes',   styleVentes);
  formaterOnglet('Paies',    stylePaies);
  creerDashboard();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Formatage terminé ! Onglet Dashboard créé.',
    '🤠 LTD Sandy Shores',
    5
  );
}

function formaterEntetes() {
  ['Résumé', 'Dépenses', 'Ventes', 'Paies'].forEach(nom => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nom);
    if (!sheet) return;
    const lastCol = Math.max(1, sheet.getLastColumn());
    sheet.getRange(1, 1, 1, lastCol)
      .setBackground(COLOR_BLOOD)
      .setFontColor(COLOR_BONE)
      .setFontWeight('bold')
      .setHorizontalAlignment('left');
    sheet.setFrozenRows(1);
  });
}

function formaterOnglet(nomOnglet, styleFn) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(nomOnglet);
  if (!sheet) {
    SpreadsheetApp.getUi().alert(`Onglet "${nomOnglet}" introuvable. Crée-le et colle la formule IMPORTDATA en A1.`);
    return;
  }
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return;

  // Reset des styles existants
  sheet.getRange(1, 1, lastRow, lastCol).setBorder(false, false, false, false, false, false);

  // En-tête (ligne 1) : rouge sang + texte beige + gras
  sheet.getRange(1, 1, 1, lastCol)
    .setBackground(COLOR_BLOOD)
    .setFontColor(COLOR_BONE)
    .setFontWeight('bold')
    .setFontFamily('Roboto Mono')
    .setFontSize(10)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 32);

  // Lignes de données : alternance + bordures
  if (lastRow > 1) {
    const dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    dataRange
      .setBackgrounds(buildAlternateColors(lastRow - 1, lastCol))
      .setBorder(true, true, true, true, true, true, '#dcdcdc', SpreadsheetApp.BorderStyle.SOLID);
  }

  // Geler en-tête + ajuster largeurs
  sheet.setFrozenRows(1);
  for (let c = 1; c <= lastCol; c++) {
    sheet.autoResizeColumn(c);
  }

  // Style spécifique selon onglet
  styleFn(sheet, lastRow, lastCol);
}

function buildAlternateColors(rows, cols) {
  const result = [];
  for (let r = 0; r < rows; r++) {
    const color = (r % 2 === 0) ? '#ffffff' : '#f7f3eb';
    result.push(new Array(cols).fill(color));
  }
  return result;
}

// ============================================================
// STYLES SPÉCIFIQUES PAR ONGLET
// ============================================================

// === Résumé : Semaine | Date début | Date fin | CA | Bénéfice brut |
//              Dépenses totales | Charges déductibles | Masse salariale |
//              Bénéfice net | Nb ventes | Nb dépenses | Statut
function styleResume(sheet, lastRow, lastCol) {
  if (lastRow < 2) return;

  // Colonnes monétaires (D à I = 4 à 9) en format $
  const colsMontant = [4, 5, 6, 7, 8, 9];
  colsMontant.forEach(c => {
    sheet.getRange(2, c, lastRow - 1, 1).setNumberFormat('#,##0 "$"').setHorizontalAlignment('right');
  });

  // Nombres simples (J, K = 10, 11)
  [10, 11].forEach(c => {
    sheet.getRange(2, c, lastRow - 1, 1).setNumberFormat('#,##0').setHorizontalAlignment('right');
  });

  // Statut (col 12) en badge
  if (lastCol >= 12) {
    const range = sheet.getRange(2, 12, lastRow - 1, 1);
    range.setHorizontalAlignment('center').setFontWeight('bold');
    const rules = sheet.getConditionalFormatRules();
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('cloturee')
        .setBackground(COLOR_SUCCESS).setFontColor('#ffffff')
        .setRanges([range]).build()
    );
    sheet.setConditionalFormatRules(rules);
  }

  // Bénéfice net (col 9) : rouge si négatif, vert si positif
  if (lastCol >= 9) {
    const range = sheet.getRange(2, 9, lastRow - 1, 1);
    const rules = sheet.getConditionalFormatRules();
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberLessThan(0)
        .setBackground('#fde2e2').setFontColor(COLOR_DANGER).setBold(true)
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(0)
        .setFontColor(COLOR_SUCCESS).setBold(true)
        .setRanges([range]).build()
    );
    sheet.setConditionalFormatRules(rules);
  }
}

// === Dépenses : Date | Raison | Montant | Type | Déductible | Utilisateur
function styleDepenses(sheet, lastRow, lastCol) {
  if (lastRow < 2) return;

  // Date (col 1) en mono + couleur muted
  sheet.getRange(2, 1, lastRow - 1, 1)
    .setFontFamily('Roboto Mono').setFontSize(9).setFontColor('#666666');

  // Montant (col 3) en $
  sheet.getRange(2, 3, lastRow - 1, 1).setNumberFormat('#,##0 "$"').setHorizontalAlignment('right').setFontWeight('bold');

  // Type (col 4) en badge
  if (lastCol >= 4) {
    sheet.getRange(2, 4, lastRow - 1, 1).setHorizontalAlignment('center').setFontSize(9);
  }

  // Déductible (col 5)
  if (lastCol >= 5) {
    const range = sheet.getRange(2, 5, lastRow - 1, 1);
    range.setHorizontalAlignment('center').setFontWeight('bold');
    const rules = sheet.getConditionalFormatRules();
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('oui').setBackground('#d4ead4').setFontColor(COLOR_SUCCESS)
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('non').setBackground('#fde2e2').setFontColor(COLOR_DANGER)
        .setRanges([range]).build()
    );
    sheet.setConditionalFormatRules(rules);
  }
}

// === Ventes : Date | N° Facture | Vendeur | Client | Montant | Bénéfice | Paiement | Raison
function styleVentes(sheet, lastRow, lastCol) {
  if (lastRow < 2) return;

  sheet.getRange(2, 1, lastRow - 1, 1)
    .setFontFamily('Roboto Mono').setFontSize(9).setFontColor('#666666');
  sheet.getRange(2, 2, lastRow - 1, 1).setFontFamily('Roboto Mono').setFontSize(9);

  // Montant (5) + Bénéfice (6) en $
  sheet.getRange(2, 5, lastRow - 1, 1).setNumberFormat('#,##0 "$"').setHorizontalAlignment('right').setFontWeight('bold');
  sheet.getRange(2, 6, lastRow - 1, 1).setNumberFormat('#,##0 "$"').setHorizontalAlignment('right').setFontColor(COLOR_GOLD);

  // Paiement (7) en badge
  if (lastCol >= 7) {
    const range = sheet.getRange(2, 7, lastRow - 1, 1);
    range.setHorizontalAlignment('center');
    const rules = sheet.getConditionalFormatRules();
    rules.push(
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('especes').setBackground('#fff8d4').setFontColor('#7a6800')
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextContains('carte').setBackground('#d4e6ff').setFontColor(COLOR_INFO)
        .setRanges([range]).build()
    );
    sheet.setConditionalFormatRules(rules);
  }
}

// === Paies : Date | Payeur | Bénéficiaire | Montant | Période
function stylePaies(sheet, lastRow, lastCol) {
  if (lastRow < 2) return;

  sheet.getRange(2, 1, lastRow - 1, 1)
    .setFontFamily('Roboto Mono').setFontSize(9).setFontColor('#666666');

  // Montant (4) en $
  sheet.getRange(2, 4, lastRow - 1, 1).setNumberFormat('#,##0 "$"').setHorizontalAlignment('right').setFontWeight('bold').setFontColor(COLOR_BLOOD);
}

// ============================================================
// DASHBOARD — onglet récap visuel
// ============================================================
function creerDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dash = ss.getSheetByName('📊 Dashboard');
  if (!dash) {
    dash = ss.insertSheet('📊 Dashboard', 0); // 1er onglet
  }
  dash.clear();
  dash.clearConditionalFormatRules();

  // === Titre ===
  dash.getRange('A1').setValue('🤠 LTD SANDY SHORES — Tableau de bord');
  dash.getRange('A1:F1').merge()
    .setBackground(COLOR_BLOOD)
    .setFontColor(COLOR_BONE)
    .setFontWeight('bold')
    .setFontSize(18)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  dash.setRowHeight(1, 50);

  dash.getRange('A2').setValue('Comptabilité temps réel — Source : ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm'));
  dash.getRange('A2:F2').merge()
    .setBackground(COLOR_DARK)
    .setFontColor(COLOR_SAND_LIGHT)
    .setFontStyle('italic')
    .setFontSize(10)
    .setHorizontalAlignment('center');
  dash.setRowHeight(2, 24);

  dash.getRange('A3:F3').setBackground('#ffffff').setBorder(false, false, false, false, false, false);
  dash.setRowHeight(3, 12);

  // === KPIs (4 grandes cards) ===
  const kpis = [
    { titre: '📈 CA SEMAINE EN COURS',     formule: "=IFERROR(INDEX(Résumé!D:D, 2), 0)",           color: COLOR_SUCCESS,  fmt: '#,##0 "$"' },
    { titre: '💸 DÉPENSES SEMAINE',         formule: "=IFERROR(INDEX(Résumé!F:F, 2), 0)",           color: COLOR_BLOOD,    fmt: '#,##0 "$"' },
    { titre: '💰 MASSE SALARIALE',          formule: "=IFERROR(INDEX(Résumé!H:H, 2), 0)",           color: COLOR_WARNING,  fmt: '#,##0 "$"' },
    { titre: '🎯 BÉNÉFICE NET',             formule: "=IFERROR(INDEX(Résumé!I:I, 2), 0)",           color: COLOR_INFO,     fmt: '#,##0 "$"' }
  ];

  let row = 4;
  kpis.forEach((kpi, i) => {
    const startCol = i * 1 + 1; // 1 colonne par KPI = pas idéal, on va faire 2x2
  });

  // Layout 2 colonnes x 2 lignes pour les KPIs
  const kpiPositions = [
    { range: 'A4:C7', titre: kpis[0].titre, formule: kpis[0].formule, color: kpis[0].color, fmt: kpis[0].fmt },
    { range: 'D4:F7', titre: kpis[1].titre, formule: kpis[1].formule, color: kpis[1].color, fmt: kpis[1].fmt },
    { range: 'A8:C11', titre: kpis[2].titre, formule: kpis[2].formule, color: kpis[2].color, fmt: kpis[2].fmt },
    { range: 'D8:F11', titre: kpis[3].titre, formule: kpis[3].formule, color: kpis[3].color, fmt: kpis[3].fmt }
  ];

  kpiPositions.forEach(kpi => {
    // Bloc entier coloré
    const block = dash.getRange(kpi.range);
    block.setBackground('#fafafa')
      .setBorder(true, true, true, true, false, false, kpi.color, SpreadsheetApp.BorderStyle.SOLID_THICK);

    // Première ligne : titre
    const [topLeft] = kpi.range.split(':');
    const colLetter = topLeft.match(/[A-Z]+/)[0];
    const rowNum = parseInt(topLeft.match(/\d+/)[0]);
    const lastCol2 = kpi.range.split(':')[1].match(/[A-Z]+/)[0];

    const titleRange = dash.getRange(`${colLetter}${rowNum}:${lastCol2}${rowNum}`).merge();
    titleRange.setValue(kpi.titre)
      .setBackground(kpi.color)
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setFontSize(11)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    dash.setRowHeight(rowNum, 30);

    // Lignes 2-4 : valeur en gros
    const valueRange = dash.getRange(`${colLetter}${rowNum + 1}:${lastCol2}${rowNum + 3}`).merge();
    valueRange.setFormula(kpi.formule)
      .setNumberFormat(kpi.fmt)
      .setFontSize(28)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setFontColor(COLOR_DARK);
  });

  // === Section "Dernières opérations" ===
  dash.getRange('A12:F12').setBackground('#ffffff');
  dash.setRowHeight(12, 16);

  dash.getRange('A13').setValue('🕐 5 DERNIÈRES VENTES');
  dash.getRange('A13:C13').merge()
    .setBackground(COLOR_DARK).setFontColor(COLOR_SAND_LIGHT)
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(13, 28);

  dash.getRange('D13').setValue('🕐 5 DERNIÈRES DÉPENSES');
  dash.getRange('D13:F13').merge()
    .setBackground(COLOR_DARK).setFontColor(COLOR_SAND_LIGHT)
    .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');

  // 5 dernières ventes (Date | Vendeur | Montant)
  for (let i = 0; i < 5; i++) {
    const r = 14 + i;
    dash.getRange(`A${r}`).setFormula(`=IFERROR(INDEX(Ventes!A:A, ${i + 2}), "")`).setFontFamily('Roboto Mono').setFontSize(9);
    dash.getRange(`B${r}`).setFormula(`=IFERROR(INDEX(Ventes!C:C, ${i + 2}), "")`).setFontSize(10);
    dash.getRange(`C${r}`).setFormula(`=IFERROR(INDEX(Ventes!E:E, ${i + 2}), "")`).setNumberFormat('#,##0 "$"').setFontWeight('bold').setHorizontalAlignment('right');

    dash.getRange(`D${r}`).setFormula(`=IFERROR(INDEX(Dépenses!A:A, ${i + 2}), "")`).setFontFamily('Roboto Mono').setFontSize(9);
    dash.getRange(`E${r}`).setFormula(`=IFERROR(INDEX(Dépenses!B:B, ${i + 2}), "")`).setFontSize(10);
    dash.getRange(`F${r}`).setFormula(`=IFERROR(INDEX(Dépenses!C:C, ${i + 2}), "")`).setNumberFormat('#,##0 "$"').setFontWeight('bold').setHorizontalAlignment('right').setFontColor(COLOR_BLOOD);
  }

  // Bordures sur les blocs opérations
  dash.getRange('A14:C18').setBorder(true, true, true, true, true, true, '#dcdcdc', SpreadsheetApp.BorderStyle.SOLID);
  dash.getRange('D14:F18').setBorder(true, true, true, true, true, true, '#dcdcdc', SpreadsheetApp.BorderStyle.SOLID);

  // === Footer ===
  dash.getRange('A20').setValue('🌵 Données mises à jour automatiquement (~1h Google IMPORTDATA). Pour forcer un refresh : menu 🤠 LTD → Forcer refresh.');
  dash.getRange('A20:F20').merge()
    .setFontStyle('italic').setFontSize(9).setFontColor('#888888')
    .setHorizontalAlignment('center');

  // Largeurs colonnes
  for (let c = 1; c <= 6; c++) dash.setColumnWidth(c, 130);

  // Cache la grille pour un rendu plus propre
  dash.setHiddenGridlines(true);
}

// ============================================================
// FORCER LE REFRESH DES IMPORTDATA
// (Sheets cache 1h, on contourne en modifiant temporairement les cellules)
// ============================================================
function forcerRefresh() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Résumé', 'Dépenses', 'Ventes', 'Paies'].forEach(nom => {
    const sheet = ss.getSheetByName(nom);
    if (!sheet) return;
    const cell = sheet.getRange('A1');
    const formule = cell.getFormula();
    if (formule.startsWith('=IMPORTDATA')) {
      cell.setFormula(''); // efface temporairement
      SpreadsheetApp.flush();
      Utilities.sleep(500);
      cell.setFormula(formule); // remet la formule -> nouveau fetch
    }
  });
  SpreadsheetApp.getActiveSpreadsheet().toast('Refresh forcé. Patiente 5-10 sec.', '🤠 LTD', 4);
}
