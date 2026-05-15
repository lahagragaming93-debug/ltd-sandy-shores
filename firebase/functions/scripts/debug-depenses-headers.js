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

// Lit les 3 premières lignes de chaque onglet data
for (const onglet of ['Depenses', 'Ventes', 'Paies', 'resumé']) {
  console.log(`\n=== '${onglet}' (3 premières lignes) ===`);
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${onglet}'!A1:Z3`,
    valueRenderOption: 'UNFORMATTED_VALUE'
  });
  const rows = r.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    console.log(`  ${i + 1}: ${(rows[i] || []).map(x => String(x).slice(0, 30)).join(' | ')}`);
  }
}

// Compte le nombre de lignes dans Depenses
const meta = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range: `'Depenses'!A:A`,
});
console.log(`\nDepenses : ${(meta.data.values || []).length} lignes au total (avec header)`);

process.exit(0);
