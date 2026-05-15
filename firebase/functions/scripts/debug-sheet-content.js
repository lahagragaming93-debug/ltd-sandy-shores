// ============================================================
// Diagnostic : lit le Sheet pour voir les feuilles + le contenu actuel
// ============================================================
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { google as googleapis } from 'googleapis';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHEET_ID = '1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY';

const dashboardSAKeyRaw = execSync(
  'firebase functions:secrets:access DASHBOARD_SA_KEY --project ltd-sandy-shores-f3919',
  { cwd: resolve(__dirname, '../..'), encoding: 'utf-8' }
).trim();
const dashboardSAKey = JSON.parse(dashboardSAKeyRaw);

const auth = new googleapis.auth.GoogleAuth({
  credentials: dashboardSAKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = googleapis.sheets({ version: 'v4', auth });

// 1) Liste toutes les feuilles
const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
console.log('=== Feuilles du Sheet ===');
for (const s of meta.data.sheets) {
  console.log(`  - "${s.properties.title}" (id=${s.properties.sheetId}, rows=${s.properties.gridProperties.rowCount}, cols=${s.properties.gridProperties.columnCount})`);
}

// 2) Pour chaque feuille, cherche les 2 factures
console.log('\n=== Recherche des factures 1915883 et 1915942 ===');
for (const s of meta.data.sheets) {
  const title = s.properties.title;
  try {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${title}'`,
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    const rows = r.data.values || [];
    let found = false;
    for (let i = 0; i < rows.length; i++) {
      const line = (rows[i] || []).join(' | ');
      if (line.includes('1915883') || line.includes('1915942')) {
        console.log(`\n  [${title}] ligne ${i + 1}:`);
        console.log(`    ${line}`);
        found = true;
      }
    }
    if (!found) {
      console.log(`  [${title}] : aucune mention des factures`);
    }
  } catch (e) {
    console.log(`  [${title}] : erreur lecture — ${e.message}`);
  }
}

process.exit(0);
