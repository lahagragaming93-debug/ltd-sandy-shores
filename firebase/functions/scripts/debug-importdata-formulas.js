import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { google as googleapis } from 'googleapis';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHEET_ID = '1mD-N3e_JpcLceiLSzDgGe01VKVf4KoO5vedM0OsnwtY';

const saRaw = execSync(
  'firebase functions:secrets:access DASHBOARD_SA_KEY --project ltd-sandy-shores-f3919',
  { cwd: resolve(__dirname, '../..'), encoding: 'utf-8' }
).trim();
const sa = JSON.parse(saRaw);

const auth = new googleapis.auth.GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = googleapis.sheets({ version: 'v4', auth });

const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, includeGridData: false });
for (const s of meta.data.sheets) {
  const title = s.properties.title;
  const r = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${title}'!A1:A3`,
    valueRenderOption: 'FORMULA'
  });
  const rows = r.data.values || [];
  for (let i = 0; i < rows.length; i++) {
    const cell = (rows[i] || [])[0];
    if (typeof cell === 'string' && /IMPORTDATA/i.test(cell)) {
      console.log(`[${title}] A${i+1} = ${cell}`);
    }
  }
}
process.exit(0);
