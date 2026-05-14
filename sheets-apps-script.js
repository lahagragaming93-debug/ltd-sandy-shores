/**
 * ============================================================
 * LTD Sandy Shores — Script Sheet Compta (Dashboard valeurs + trigger)
 * ============================================================
 *
 * - En-têtes des 4 onglets (Resume / Depenses / Ventes / Paies) en rouge sang
 * - Onglet "📊 Dashboard" auto-généré avec VALEURS STATIQUES (pas de
 *   formules) : lecture depuis les onglets sources via getValues(),
 *   écriture via setValues()
 * - Trigger horaire qui rafraîchit le Dashboard automatiquement
 * - Renomme les anciens onglets accentués si présents (Résumé, Dépenses)
 *
 * Installation (5 min, à faire UNE FOIS) :
 *  1. Ouvre ton Sheet : https://docs.google.com/spreadsheets/d/1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY/edit
 *  2. Menu  Extensions  →  Apps Script
 *  3. Efface le code par défaut, colle TOUT ce fichier
 *  4. Sauvegarde (Ctrl+S) — nomme le projet "LTD Format"
 *  5. Sélectionne la fonction "formaterEtDashboard" puis ▶ Exécuter
 *  6. Autorise les permissions Google demandées (Sheet + Triggers)
 *  7. Reviens sur le Sheet, F5 → menu "🤠 LTD" + onglet Dashboard
 *
 * Le trigger horaire rafraîchit le Dashboard tout seul. Pour relancer
 * manuellement : menu "🤠 LTD" → Reformater tout / Recréer le Dashboard.
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
};

const ONGLETS_CIBLES = ['Resume', 'Depenses', 'Ventes', 'Paies', 'Banque'];

// ============================================================
// MENU CUSTOM (apparaît à l'ouverture)
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🤠 LTD')
    .addItem('🎨 Reformater tout', 'formaterEtDashboard')
    .addItem('📊 Recréer le Dashboard', 'creerDashboard')
    .addToUi();
}

// ============================================================
// FONCTION PRINCIPALE — à lancer 1 fois après installation
// ============================================================
function formaterEtDashboard() {
  formaterEntetes();
  creerDashboard();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Terminé ! Dashboard créé + trigger horaire activé.',
    '🤠 LTD',
    4
  );
}

// ============================================================
// MIGRATION : renomme les anciens onglets accentués
// (le Dashboard est géré directement dans creerDashboard)
// ============================================================
function migrerOnglets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(RENAMES).forEach(oldName => {
    const newName = RENAMES[oldName];
    const oldSheet = ss.getSheetByName(oldName);
    const newSheet = ss.getSheetByName(newName);
    if (oldSheet && !newSheet) {
      oldSheet.setName(newName);
    }
  });
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
// LECTURE des onglets sources — retourne les valeurs nécessaires
// ============================================================
function lireDonneesSources() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = {
    ca: 0, depenses: 0, masse: 0, benefice: 0,
    ventes: [],         // [[date, vendeur, montant], …]
    depensesOps: [],    // [[date, raison, montant], …]
    historique: [],     // [[semaine, dateDebut, dateFin, CA, depenses, masse, primes, benefice], …]
    totaux: { ca: 0, depenses: 0, masse: 0, primes: 0, benefice: 0 }
  };

  // === Resume : 1ère ligne = semaine en cours, suite = historique ===
  // Colonnes (14 total) :
  //   0=Semaine, 1=Date début, 2=Date fin, 3=CA, 4=Bénéfice brut,
  //   5=Dépenses totales, 6=Charges déductibles, 7=Masse salariale,
  //   8=Prime hebdo (Art. 4-1.10), 9=Prime mensuelle (Art. 4-1.11),
  //   10=Bénéfice net, 11=Nb ventes, 12=Nb dépenses, 13=Statut
  const resume = ss.getSheetByName('Resume');
  if (resume && resume.getLastRow() >= 2) {
    const numRows = resume.getLastRow() - 1;
    const allRows = resume.getRange(2, 1, numRows, 14).getValues();

    // KPIs = première ligne (semaine en cours)
    const row0 = allRows[0];
    data.ca       = Number(row0[3]) || 0;
    data.depenses = Number(row0[5]) || 0;
    data.masse    = Number(row0[7]) || 0;
    data.benefice = Number(row0[10]) || 0;

    // Historique IRS = toutes les lignes (audit complet) — 8 colonnes
    data.historique = allRows.map(r => {
      const primes = (Number(r[8]) || 0) + (Number(r[9]) || 0);
      return [
        r[0],                 // Semaine
        r[1],                 // Date début
        r[2],                 // Date fin
        Number(r[3]) || 0,    // CA
        Number(r[5]) || 0,    // Dépenses totales
        Number(r[7]) || 0,    // Masse salariale
        primes,               // Primes (hebdo + mensuelle)
        Number(r[10]) || 0    // Bénéfice net
      ];
    });

    // Totaux cumulés (audit IRS sur toute la période)
    data.totaux.ca       = data.historique.reduce((s, r) => s + r[3], 0);
    data.totaux.depenses = data.historique.reduce((s, r) => s + r[4], 0);
    data.totaux.masse    = data.historique.reduce((s, r) => s + r[5], 0);
    data.totaux.primes   = data.historique.reduce((s, r) => s + r[6], 0);
    data.totaux.benefice = data.historique.reduce((s, r) => s + r[7], 0);
  }

  // === Ventes : 5 dernières (lignes 2-6). Colonnes utiles : A=Date, C=Vendeur, E=Montant ===
  const ventes = ss.getSheetByName('Ventes');
  if (ventes && ventes.getLastRow() >= 2) {
    const numRows = Math.min(5, ventes.getLastRow() - 1);
    if (numRows > 0) {
      const raw = ventes.getRange(2, 1, numRows, 5).getValues();
      data.ventes = raw.map(r => [r[0], r[2], r[4]]);
    }
  }
  while (data.ventes.length < 5) data.ventes.push(['', '', '']);

  // === Dépenses : 5 dernières (lignes 2-6). Colonnes utiles : A=Date, B=Raison, C=Montant ===
  const depenses = ss.getSheetByName('Depenses');
  if (depenses && depenses.getLastRow() >= 2) {
    const numRows = Math.min(5, depenses.getLastRow() - 1);
    if (numRows > 0) {
      data.depensesOps = depenses.getRange(2, 1, numRows, 3).getValues();
    }
  }
  while (data.depensesOps.length < 5) data.depensesOps.push(['', '', '']);

  return data;
}

// ============================================================
// DASHBOARD — onglet récap visuel (VALEURS STATIQUES)
// ============================================================
function creerDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) Migration : renomme onglets accentués si nécessaire
  migrerOnglets();

  // 2) Supprime puis recrée le Dashboard pour repartir propre
  const oldDash = ss.getSheetByName('📊 Dashboard');
  if (oldDash) ss.deleteSheet(oldDash);
  const dash = ss.insertSheet('📊 Dashboard', 0);

  // 3) Lecture des données depuis les onglets sources
  const data = lireDonneesSources();

  // === Titre ===
  dash.getRange('A1:H1').merge()
    .setValue('🤠 LTD SANDY SHORES — Comptabilité')
    .setBackground(COLOR_BLOOD)
    .setFontColor(COLOR_BONE)
    .setFontWeight('bold')
    .setFontSize(18)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  dash.setRowHeight(1, 50);

  dash.getRange('A2:H2').merge()
    .setValue('Mis à jour : ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm') + ' (auto-refresh horaire)')
    .setBackground(COLOR_DARK)
    .setFontColor(COLOR_BONE)
    .setFontStyle('italic')
    .setFontSize(10)
    .setHorizontalAlignment('center');
  dash.setRowHeight(2, 22);

  dash.setRowHeight(3, 12);

  // === 4 KPIs en 2x2 (valeurs statiques) ===
  const kpis = [
    { row: 4, colStart: 'A', colEnd: 'C', titre: '📈 CA SEMAINE',     value: data.ca,       color: COLOR_GREEN },
    { row: 4, colStart: 'D', colEnd: 'F', titre: '💸 DÉPENSES',        value: data.depenses, color: COLOR_BLOOD },
    { row: 8, colStart: 'A', colEnd: 'C', titre: '💰 MASSE SALARIALE', value: data.masse,    color: COLOR_ORANGE },
    { row: 8, colStart: 'D', colEnd: 'F', titre: '🎯 BÉNÉFICE NET',    value: data.benefice, color: COLOR_BLUE }
  ];

  kpis.forEach(kpi => {
    // Bandeau titre
    const titre = dash.getRange(`${kpi.colStart}${kpi.row}:${kpi.colEnd}${kpi.row}`).merge();
    titre.setValue(kpi.titre)
      .setBackground(kpi.color)
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setFontSize(11)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    dash.setRowHeight(kpi.row, 28);

    // Valeur (3 lignes mergées en dessous) — VALEUR STATIQUE
    const valeur = dash.getRange(`${kpi.colStart}${kpi.row + 1}:${kpi.colEnd}${kpi.row + 3}`).merge();
    valeur.setValue(kpi.value)
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

  // Écriture en bloc des valeurs (1 setValues par bloc)
  dash.getRange('A14:C18').setValues(data.ventes);
  dash.getRange('D14:F18').setValues(data.depensesOps);

  // Format des colonnes montant (en bloc)
  dash.getRange('C14:C18').setNumberFormat('#,##0 "$"').setFontWeight('bold').setHorizontalAlignment('right');
  dash.getRange('F14:F18').setNumberFormat('#,##0 "$"').setFontWeight('bold').setHorizontalAlignment('right').setFontColor(COLOR_BLOOD);

  // === HISTORIQUE DES SEMAINES (audit IRS) ===
  // Bandeau d'intro
  dash.setRowHeight(19, 16);
  dash.getRange('A20:H20').merge()
    .setValue('📋 HISTORIQUE DES SEMAINES — Audit IRS (toutes semaines clôturées)')
    .setBackground(COLOR_BLOOD)
    .setFontColor(COLOR_BONE)
    .setFontWeight('bold').setFontSize(12)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(20, 32);

  // En-tête tableau (8 colonnes : ajout "Primes" entre Masse et Bénéfice)
  const enTetes = [['Semaine', 'Date début', 'Date fin', 'CA', 'Dépenses', 'Masse salariale', 'Primes (TTE)', 'Bénéfice net']];
  dash.getRange('A21:H21').setValues(enTetes)
    .setBackground(COLOR_DARK).setFontColor(COLOR_BONE)
    .setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(21, 26);

  // Données : toutes les semaines clôturées (8 cols : semaine, début, fin, ca, dep, masse, primes, bénéfice)
  if (data.historique.length > 0) {
    const startRow = 22;
    const endRow = startRow + data.historique.length - 1;

    dash.getRange(startRow, 1, data.historique.length, 8).setValues(data.historique);

    // Format colonnes monétaires (D à H = 4 à 8)
    dash.getRange(startRow, 4, data.historique.length, 5).setNumberFormat('#,##0 "$"').setHorizontalAlignment('right');
    // Bénéfice net (col H) en gras
    dash.getRange(startRow, 8, data.historique.length, 1).setFontWeight('bold');
    // Primes (col G) en doré
    dash.getRange(startRow, 7, data.historique.length, 1).setFontColor(COLOR_GOLD);

    // Bordures légères
    dash.getRange(startRow, 1, data.historique.length, 8)
      .setBorder(true, true, true, true, true, true, '#dcdcdc', SpreadsheetApp.BorderStyle.SOLID);

    // === Total cumulé en bas (audit IRS) ===
    const totalRow = endRow + 1;
    dash.getRange(totalRow, 1, 1, 3).merge()
      .setValue('TOTAL CUMULÉ (' + data.historique.length + ' semaines)')
      .setBackground(COLOR_GOLD).setFontColor(COLOR_DARK)
      .setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    dash.getRange(totalRow, 4).setValue(data.totaux.ca);
    dash.getRange(totalRow, 5).setValue(data.totaux.depenses);
    dash.getRange(totalRow, 6).setValue(data.totaux.masse);
    dash.getRange(totalRow, 7).setValue(data.totaux.primes);
    dash.getRange(totalRow, 8).setValue(data.totaux.benefice);
    dash.getRange(totalRow, 4, 1, 5)
      .setNumberFormat('#,##0 "$"')
      .setBackground('#fff8d4').setFontColor(COLOR_DARK)
      .setFontWeight('bold').setFontSize(11)
      .setHorizontalAlignment('right');
    dash.setRowHeight(totalRow, 32);

    var footerRow = totalRow + 2;
  } else {
    dash.getRange('A22:H22').merge()
      .setValue('Aucune semaine clôturée pour le moment.')
      .setFontStyle('italic').setFontColor('#888888').setHorizontalAlignment('center');
    var footerRow = 24;
  }

  // === Section "Audit IRS — où trouver le détail" ===
  const auditRow = footerRow;
  dash.getRange(auditRow, 1, 1, 8).merge()
    .setValue('🔎 AUDIT IRS — Où trouver le détail (justificatifs, salaires, etc.)')
    .setBackground(COLOR_DARK).setFontColor(COLOR_BONE)
    .setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(auditRow, 28);

  const auditLignes = [
    ['📁 Onglet "Depenses"',  'Toutes les dépenses avec date, raison, montant, type (matières premières / avocat / véhicules / loyer / nourriture / décoration / dons / autre / non déductible), déductible oui/non, fournisseur identifié (Yootool, HDM, Dynasty 8…), validé par patron oui/non, justification (audit IRS), utilisateur qui a saisi'],
    ['📁 Onglet "Ventes"',     'Toutes les recettes avec date, n° facture, vendeur, client, montant, bénéfice, mode de paiement, raison'],
    ['📁 Onglet "Paies"',      'Tous les salaires versés avec date, payeur, bénéficiaire, montant, période concernée'],
    ['📁 Onglet "Resume"',     'Récap par semaine clôturée : CA, charges déductibles, masse salariale, primes (Art. 4-1.10 hebdo + Art. 4-1.11 mensuel), bénéfice net'],
    ['📁 Onglet "Banque"',     'TOUS les mouvements bancaires LTD chronologiques (entrées xbankaccount + sorties #depenses) avec solde après chaque opération. Audit financier complet.']
  ];
  const auditStart = auditRow + 1;
  auditLignes.forEach((ligne, i) => {
    const r = auditStart + i;
    dash.getRange(r, 1, 1, 2).merge()
      .setValue(ligne[0])
      .setBackground('#fafafa').setFontWeight('bold').setFontSize(10)
      .setVerticalAlignment('middle').setHorizontalAlignment('left');
    dash.getRange(r, 3, 1, 6).merge()
      .setValue(ligne[1])
      .setBackground('#ffffff').setFontSize(10)
      .setVerticalAlignment('middle').setWrap(true);
    dash.setRowHeight(r, 36);
  });

  // === Footer ===
  const footerFinal = auditStart + auditLignes.length + 1;
  dash.getRange(footerFinal, 1, 1, 8).merge()
    .setValue('🌵 Dashboard rafraîchi automatiquement toutes les heures • Pour forcer maintenant : menu 🤠 LTD → Recréer le Dashboard')
    .setFontStyle('italic').setFontSize(9).setFontColor('#888888')
    .setHorizontalAlignment('center');

  // Largeurs colonnes (8 colonnes maintenant : A-H)
  const widths = [110, 100, 100, 100, 100, 110, 100, 120];
  for (let c = 0; c < widths.length; c++) dash.setColumnWidth(c + 1, widths[c]);

  // Cache la grille
  dash.setHiddenGridlines(true);

  // 4) Trigger horaire (idempotent : supprime existants + recrée)
  setupTriggerHoraire();
}

// ============================================================
// TRIGGER HORAIRE pour rafraîchir le Dashboard automatiquement
// ============================================================
function setupTriggerHoraire() {
  // Supprime tous les triggers existants pour creerDashboard (évite doublons)
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'creerDashboard') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Crée un nouveau trigger horaire
  ScriptApp.newTrigger('creerDashboard')
    .timeBased()
    .everyHours(1)
    .create();
}
