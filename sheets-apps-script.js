/**
 * ============================================================
 * LTD Sandy Shores — Script léger Sheet Compta (< 30 sec)
 * ============================================================
 *
 * Version allégée : uniquement en-têtes rouge sang + Dashboard 4 KPIs.
 * Pas de mise en forme sur les data rows (trop coûteux pour Apps Script
 * sur 2000+ lignes — provoque timeout 30s).
 *
 * IMPORTANT : les onglets cibles utilisent des noms SANS accents
 * (Resume, Depenses, Ventes, Paies). Le script renomme automatiquement
 * les anciens onglets (Résumé, Dépenses) au premier lancement.
 *
 * Installation (5 min, à faire UNE FOIS) :
 *  1. Ouvre ton Sheet : https://docs.google.com/spreadsheets/d/1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY/edit
 *  2. Menu  Extensions  →  Apps Script
 *  3. Efface le code par défaut, colle TOUT ce fichier
 *  4. Sauvegarde (Ctrl+S) — nomme le projet "LTD Format"
 *  5. Sélectionne la fonction "formaterEtDashboard" puis ▶ Exécuter
 *  6. Autorise les permissions Google demandées
 *  7. Reviens sur le Sheet, F5 → tu vois le menu "🤠 LTD" + onglet Dashboard
 *
 * Pour relancer après : menu "🤠 LTD" → Reformater tout
 * ============================================================ */

// === Couleurs LTD ===
const COLOR_BLOOD  = '#8B0000';
const COLOR_BONE   = '#F5F0E8';
const COLOR_DARK   = '#1a1a1a';
const COLOR_GOLD   = '#c9a961';
const COLOR_GREEN  = '#4a7c2e';
const COLOR_ORANGE = '#c97f1a';
const COLOR_BLUE   = '#4a6b8a';

// === Mapping ancien nom → nouveau nom (sans accents) ===
const RENAMES = {
  'Résumé':   'Resume',
  'Dépenses': 'Depenses'
  // Ventes / Paies : pas de changement
};

// Liste des onglets cibles (noms définitifs)
const ONGLETS_CIBLES = ['Resume', 'Depenses', 'Ventes', 'Paies'];

// ============================================================
// MENU CUSTOM (apparaît à l'ouverture)
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🤠 LTD')
    .addItem('🎨 Reformater tout', 'formaterEtDashboard')
    .addItem('📊 Recréer le Dashboard', 'creerDashboard')
    .addSeparator()
    .addItem('🔄 Forcer refresh IMPORTDATA', 'forcerRefresh')
    .addToUi();
}

// ============================================================
// FONCTION PRINCIPALE — à lancer 1 fois après installation
// ============================================================
function formaterEtDashboard() {
  formaterEntetes();
  creerDashboard();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Terminé ! Onglet Dashboard créé.',
    '🤠 LTD',
    4
  );
}

// ============================================================
// MIGRATION : renomme les anciens onglets accentués + supprime
// l'ancien Dashboard si présent
// ============================================================
function migrerOnglets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Renomme Résumé → Resume, Dépenses → Depenses (si présents)
  Object.keys(RENAMES).forEach(oldName => {
    const newName = RENAMES[oldName];
    const oldSheet = ss.getSheetByName(oldName);
    const newSheet = ss.getSheetByName(newName);
    if (oldSheet && !newSheet) {
      oldSheet.setName(newName);
    }
  });

  // Supprime l'ancien Dashboard s'il existe (sera recréé propre)
  const oldDash = ss.getSheetByName('📊 Dashboard');
  if (oldDash) {
    ss.deleteSheet(oldDash);
  }
}

// ============================================================
// FORMATAGE DES EN-TÊTES (1 ligne par onglet, ultra rapide)
// ============================================================
function formaterEntetes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ONGLETS_CIBLES.forEach(nom => {
    const sheet = ss.getSheetByName(nom);
    if (!sheet) return;

    const lastCol = Math.max(1, sheet.getLastColumn());
    sheet.getRange(1, 1, 1, lastCol)
      .setBackground(COLOR_BLOOD)
      .setFontColor(COLOR_BONE)
      .setFontWeight('bold')
      .setFontSize(11)
      .setHorizontalAlignment('left')
      .setVerticalAlignment('middle');

    sheet.setRowHeight(1, 32);
    sheet.setFrozenRows(1);
  });
}

// ============================================================
// DASHBOARD — onglet récap visuel (KPIs + dernières ops)
// ============================================================
function creerDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) Migration : renomme onglets accentués + supprime ancien Dashboard
  migrerOnglets();

  // 2) Crée le Dashboard (toujours en première position)
  const dash = ss.insertSheet('📊 Dashboard', 0);

  // === Titre ===
  dash.getRange('A1:F1').merge()
    .setValue('🤠 LTD SANDY SHORES — Comptabilité')
    .setBackground(COLOR_BLOOD)
    .setFontColor(COLOR_BONE)
    .setFontWeight('bold')
    .setFontSize(18)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  dash.setRowHeight(1, 50);

  dash.getRange('A2:F2').merge()
    .setValue('Mis à jour : ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm'))
    .setBackground(COLOR_DARK)
    .setFontColor(COLOR_BONE)
    .setFontStyle('italic')
    .setFontSize(10)
    .setHorizontalAlignment('center');
  dash.setRowHeight(2, 22);

  // Espace
  dash.setRowHeight(3, 12);

  // === 4 KPIs en 2x2 ===
  // Disposition :
  //   A4:C7  = CA       |  D4:F7  = Depenses
  //   A8:C11 = Masse    |  D8:F11 = Benefice
  const kpis = [
    { row: 4,  colStart: 'A', colEnd: 'C', titre: '📈 CA SEMAINE',      formule: '=IFERROR(INDEX(Resume!D:D, 2), 0)', color: COLOR_GREEN },
    { row: 4,  colStart: 'D', colEnd: 'F', titre: '💸 DÉPENSES',         formule: '=IFERROR(INDEX(Resume!F:F, 2), 0)', color: COLOR_BLOOD },
    { row: 8,  colStart: 'A', colEnd: 'C', titre: '💰 MASSE SALARIALE',  formule: '=IFERROR(INDEX(Resume!H:H, 2), 0)', color: COLOR_ORANGE },
    { row: 8,  colStart: 'D', colEnd: 'F', titre: '🎯 BÉNÉFICE NET',     formule: '=IFERROR(INDEX(Resume!I:I, 2), 0)', color: COLOR_BLUE }
  ];

  kpis.forEach(kpi => {
    // Bandeau titre (1 ligne)
    const titre = dash.getRange(`${kpi.colStart}${kpi.row}:${kpi.colEnd}${kpi.row}`).merge();
    titre.setValue(kpi.titre)
      .setBackground(kpi.color)
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setFontSize(11)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    dash.setRowHeight(kpi.row, 28);

    // Valeur (3 lignes mergées en dessous)
    const valeur = dash.getRange(`${kpi.colStart}${kpi.row + 1}:${kpi.colEnd}${kpi.row + 3}`).merge();
    valeur.setFormula(kpi.formule)
      .setNumberFormat('#,##0 "$"')
      .setFontSize(26)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setBackground('#fafafa')
      .setFontColor(COLOR_DARK);
    dash.setRowHeight(kpi.row + 1, 30);
    dash.setRowHeight(kpi.row + 2, 30);
    dash.setRowHeight(kpi.row + 3, 30);
  });

  // === Dernières opérations (2 colonnes côte à côte) ===
  dash.setRowHeight(12, 16);

  dash.getRange('A13:C13').merge()
    .setValue('🕐 5 DERNIÈRES VENTES')
    .setBackground(COLOR_DARK).setFontColor(COLOR_BONE)
    .setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  dash.getRange('D13:F13').merge()
    .setValue('🕐 5 DERNIÈRES DÉPENSES')
    .setBackground(COLOR_DARK).setFontColor(COLOR_BONE)
    .setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(13, 26);

  // 5 lignes d'ops : on construit toutes les formules en une seule passe
  const ventesFormules = [];
  const depensesFormules = [];
  for (let i = 0; i < 5; i++) {
    const idx = i + 2;
    ventesFormules.push([
      `=IFERROR(INDEX(Ventes!A:A, ${idx}), "")`,
      `=IFERROR(INDEX(Ventes!C:C, ${idx}), "")`,
      `=IFERROR(INDEX(Ventes!E:E, ${idx}), "")`
    ]);
    depensesFormules.push([
      `=IFERROR(INDEX(Depenses!A:A, ${idx}), "")`,
      `=IFERROR(INDEX(Depenses!B:B, ${idx}), "")`,
      `=IFERROR(INDEX(Depenses!C:C, ${idx}), "")`
    ]);
  }

  // Set en bloc (1 seule API call par bloc)
  dash.getRange('A14:C18').setFormulas(ventesFormules);
  dash.getRange('D14:F18').setFormulas(depensesFormules);

  // Format des colonnes montant (en bloc)
  dash.getRange('C14:C18').setNumberFormat('#,##0 "$"').setFontWeight('bold').setHorizontalAlignment('right');
  dash.getRange('F14:F18').setNumberFormat('#,##0 "$"').setFontWeight('bold').setHorizontalAlignment('right').setFontColor(COLOR_BLOOD);

  // === Footer ===
  dash.getRange('A20:F20').merge()
    .setValue('🌵 Données auto via IMPORTDATA (refresh ~1h Google) • Pour forcer : menu 🤠 LTD → Forcer refresh')
    .setFontStyle('italic').setFontSize(9).setFontColor('#888888')
    .setHorizontalAlignment('center');

  // Largeurs colonnes (1 appel par colonne, mais 6 cols → vite)
  for (let c = 1; c <= 6; c++) dash.setColumnWidth(c, 130);

  // Cache la grille
  dash.setHiddenGridlines(true);
}

// ============================================================
// FORCER LE REFRESH DES IMPORTDATA
// (Sheets cache 1h ; on contourne en réécrivant la formule)
// ============================================================
function forcerRefresh() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ONGLETS_CIBLES.forEach(nom => {
    const sheet = ss.getSheetByName(nom);
    if (!sheet) return;
    const cell = sheet.getRange('A1');
    const formule = cell.getFormula();
    if (formule && formule.indexOf('IMPORTDATA') !== -1) {
      cell.setFormula('');
      SpreadsheetApp.flush();
      Utilities.sleep(300);
      cell.setFormula(formule);
    }
  });
  SpreadsheetApp.getActiveSpreadsheet().toast('Refresh forcé. Patiente 5-10 sec.', '🤠 LTD', 4);
}
