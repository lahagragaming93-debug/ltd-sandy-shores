// ============================================================
// Met en forme proprement les onglets du Sheet Compta
// ============================================================
// Sur chaque onglet de données (Depenses, Ventes, Paies, resumé) :
//   1. Header (ligne 1) : fond rouge sang LTD + texte blanc bold + center
//   2. Colonnes auto-resize (autoResize en pixels selon contenu)
//   3. Colonne "Justification" (sur Depenses) : wrap text + largeur max 300px
//   4. Cellules data : wrap par défaut pour éviter les textes qui débordent
//   5. Freeze ligne 1 (figée au scroll)
//
// IDEMPOTENT : on ré-applique le format à chaque appel.
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
const SHEET_ID = '1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY';
const ONGLETS_DATA = ['Depenses', 'Ventes', 'Paies', 'resumé'];

// Couleurs LTD (sang, doré, ivoire) — alignées avec sheets-apps-script.js
const COLOR_BLOOD = { red: 0.545, green: 0, blue: 0 };       // #8B0000
const COLOR_BONE  = { red: 0.961, green: 0.941, blue: 0.91 }; // #F5F0E8
const COLOR_WHITE = { red: 1, green: 1, blue: 1 };

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });

async function main() {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    includeGridData: false
  });
  const onglets = meta.data.sheets || [];
  const requests = [];

  for (const ong of onglets) {
    const title = ong.properties.title;
    if (!ONGLETS_DATA.includes(title)) continue;
    const sheetId = ong.properties.sheetId;

    // Lire pour connaître les dimensions + identifier la colonne "Justification"
    let headers = [];
    let nbRows = 1000, nbCols = 10;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: title
      });
      const data = resp.data.values || [];
      headers = (data[0] || []).map(h => String(h).trim());
      nbRows = Math.max(2, data.length);
      nbCols = Math.max(2, headers.length);
    } catch (e) {
      console.log(`  ⚠ ${title} lecture impossible : ${e.message}`);
      continue;
    }

    const idxJustification = headers.findIndex(h => /justif/i.test(h));
    const idxRaison        = headers.findIndex(h => /^raison$/i.test(h));

    // 1. HEADER en rouge sang, texte blanc bold center
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: nbCols
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLOR_BLOOD,
            textFormat: {
              foregroundColor: COLOR_WHITE,
              bold: true,
              fontSize: 11
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            padding: { top: 6, bottom: 6, left: 4, right: 4 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy,padding)'
      }
    });

    // 2. Toutes les cellules data : wrap par défaut
    if (nbRows > 1) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            endRowIndex: nbRows,
            startColumnIndex: 0,
            endColumnIndex: nbCols
          },
          cell: {
            userEnteredFormat: {
              wrapStrategy: 'WRAP',
              verticalAlignment: 'MIDDLE',
              padding: { top: 3, bottom: 3, left: 4, right: 4 }
            }
          },
          fields: 'userEnteredFormat(wrapStrategy,verticalAlignment,padding)'
        }
      });
    }

    // 3. Freeze ligne 1
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 }
        },
        fields: 'gridProperties.frozenRowCount'
      }
    });

    // 4. Auto-resize toutes les colonnes
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: nbCols
        }
      }
    });

    // 5. Colonne Justification : largeur fixe 320px (autoResize aurait fait
    // trop long pour cette colonne de texte). Idem pour Raison sur Depenses.
    if (idxJustification >= 0) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: idxJustification,
            endIndex: idxJustification + 1
          },
          properties: { pixelSize: 320 },
          fields: 'pixelSize'
        }
      });
    }
    if (idxRaison >= 0) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: idxRaison,
            endIndex: idxRaison + 1
          },
          properties: { pixelSize: 220 },
          fields: 'pixelSize'
        }
      });
    }

    console.log(`  ✓ ${title} : header rouge + wrap + autoResize + freeze ligne 1${idxJustification >= 0 ? ' + col Justification 320px' : ''}${idxRaison >= 0 ? ' + col Raison 220px' : ''}`);
  }

  if (requests.length === 0) {
    console.log('Aucun onglet traité.');
    process.exit(0);
  }

  console.log(`\nApplication de ${requests.length} request(s) batchUpdate...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests }
  });
  console.log('✓ Mise en forme appliquée. Recharge ton Sheet (F5) pour voir.');
  process.exit(0);
}

main().catch(e => { console.error('Erreur :', e.message); process.exit(2); });
