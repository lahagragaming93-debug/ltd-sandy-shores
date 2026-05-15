// Test local de forceRefreshImportData
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { google as googleapis } from 'googleapis';
import { execSync } from 'child_process';
import { forceRefreshImportData } from '../lib/refresh-importdata.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

console.log('→ Force refresh IMPORTDATA...');
const t0 = Date.now();
const result = await forceRefreshImportData({ sheets });
console.log(`✅ Terminé en ${((Date.now() - t0)/1000).toFixed(1)}s :`, result);

process.exit(0);
