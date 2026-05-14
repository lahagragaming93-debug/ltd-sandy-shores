// ============================================================
// Active les filtres natifs Google Sheets sur les onglets de données
// ============================================================
// Sur chaque onglet (Depenses, Ventes, Paies, resumé), active un
// basicFilter Google Sheets — ça pose des dropdowns ▼ sur chaque colonne
// permettant de :
//   - Trier A→Z / Z→A
//   - Filtrer par valeur (case à cocher)
//   - Filtrer par condition (texte, nombre, date)
//   - Filtrer par couleur
//
// Idempotent : si un filtre existe déjà sur la plage, on l'écrase avec
// un nouveau qui couvre la totalité des données.
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
const SHEET_ID = '1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY';

// Onglets de données (pas le Dashboard qui est de la mise en forme)
const ONGLETS_DATA = ['Depenses', 'Ventes', 'Paies', 'resumé'];

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
    // Lire pour savoir où s'arrêtent les données (combien de lignes/colonnes)
    let nbRows = 1000;
    let nbCols = 26;
    try {
      const resp = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: title
      });
      const data = resp.data.values || [];
      nbRows = Math.max(2, data.length);
      nbCols = Math.max(2, ...data.map(r => r.length));
    } catch (e) {
      console.log(`  ⚠ ${title} : lecture impossible (${e.message})`);
    }

    // 1. Supprime le filtre existant (s'il existe) — sinon setBasicFilter refuse
    requests.push({ clearBasicFilter: { sheetId } });

    // 2. Pose un nouveau basicFilter sur toute la plage (ligne header incluse)
    requests.push({
      setBasicFilter: {
        filter: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: nbRows,
            startColumnIndex: 0,
            endColumnIndex: nbCols
          }
        }
      }
    });

    console.log(`  ✓ Filtre prêt pour ${title} (${nbRows} lignes × ${nbCols} colonnes)`);
  }

  if (requests.length === 0) {
    console.log('Aucun onglet de données trouvé.');
    process.exit(0);
  }

  console.log(`\nApplication de ${requests.length} request(s) batchUpdate...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests }
  });
  console.log('✓ Filtres natifs activés sur tous les onglets de données.');
  console.log('  → Ouvre ton Sheet, chaque colonne a maintenant un ▼ cliquable pour trier/filtrer.\n');
  process.exit(0);
}

main().catch(e => { console.error('Erreur :', e.message); process.exit(2); });
